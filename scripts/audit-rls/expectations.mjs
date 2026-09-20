/**
 * Tables an anonymous caller must never read rows from.
 *
 * The publishable key is public by design, so RLS is the only thing standing
 * between a stranger and this data. A policy edit can silently reopen a table;
 * this list is what makes that visible.
 *
 * `profiles` is included: it used to be `SELECT USING (true)` and leaked every
 * user id, including the admin's. It is now scoped to profiles with an approved
 * review or a public collection, so a bare listing must still come back empty.
 */
export const ANON_INVISIBLE_TABLES = [
  "admins",
  "collections",
  "news_sources",
  "outbound_clicks",
  "profiles",
  "reviews",
  "story_excerpts",
  "subscribers",
  "tool_submissions",
];

/**
 * @param {string} table
 * @param {{status: number, rows: unknown[] | null}} response
 */
export function judge(table, response) {
  // A refusal is as good as an empty result: either way nothing leaked.
  if (response.status >= 400 || response.rows === null) {
    return { table, ok: true, detail: `refused (${response.status})` };
  }
  if (response.rows.length === 0) {
    return { table, ok: true, detail: "no rows" };
  }
  return {
    table,
    ok: false,
    detail: `LEAKED ${response.rows.length} row(s) to anon`,
  };
}

/**
 * Filtered reads that must come back empty. `stories` and `story_tools` are
 * anon-readable for *published* rows, so the table probe cannot cover them;
 * these ask specifically for what must stay hidden.
 *
 * The `story_tools` probe filters through `stories!inner(status)`, so it is
 * only exercising the parent `stories` RLS policy via the inner embed — a
 * `story_tools` row that leaked because of a relaxed `story_tools` policy of
 * its own would not necessarily be caught by this probe alone.
 */
export const ANON_INVISIBLE_QUERIES = [
  {
    label: "stories (unpublished)",
    path: "stories?select=id&status=neq.published&limit=5",
  },
  {
    label: "story_tools (unpublished)",
    path: "story_tools?select=story_id,stories!inner(status)&stories.status=neq.published&limit=5",
  },
];

const WRONG_SECRET = "audit-probe-wrong-secret-000000000000000";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Functions an anonymous caller must not be able to use. */
export const ANON_REFUSED_RPCS = [
  { fn: "ingest_sources", body: { secret: WRONG_SECRET } },
  {
    fn: "ingest_story",
    body: {
      secret: WRONG_SECRET,
      p_source_id: NIL_UUID,
      p_source_url: "https://audit.invalid/probe",
      p_headline: "audit probe",
      p_excerpt: null,
      p_image_url: null,
      p_source_published_at: null,
      p_tool_slugs: [],
    },
  },
  { fn: "touch_news_source", body: { secret: WRONG_SECRET, p_source_id: NIL_UUID, p_error: null } },
  {
    fn: "admin_publish_story",
    body: {
      p_story_id: NIL_UUID,
      p_slug: "audit-probe",
      p_headline: "audit probe",
      p_summary: "x".repeat(40),
      p_take: null,
      p_beat: "research",
      p_featured: false,
      p_tool_slugs: [],
    },
  },
  { fn: "admin_set_story_status", body: { p_story_id: NIL_UUID, p_status: "rejected" } },
];

/** @param {string} label @param {{status: number, rows: unknown[] | null}} response */
export function judgeQuery(label, response) {
  if (response.status !== 200 || response.rows === null) {
    return { table: label, ok: false, detail: `probe errored (${response.status}); fix the probe` };
  }
  if (response.rows.length === 0) return { table: label, ok: true, detail: "no rows" };
  return { table: label, ok: false, detail: `LEAKED ${response.rows.length} row(s) to anon` };
}

/** @param {string} fn @param {{status: number, body: unknown}} response */
export function judgeRpc(fn, response) {
  // A 5xx means the request never reached the RLS/permission check that this
  // probe exists to exercise; treat it as a broken probe, not a pass.
  if (response.status >= 500) {
    return {
      table: `rpc ${fn}`,
      ok: false,
      detail: `probe errored (${response.status}); fix the probe`,
    };
  }
  const code =
    response.body && typeof response.body === "object" && "code" in response.body
      ? response.body.code
      : undefined;
  // PostgREST returns 404 with this code when the function name or signature
  // no longer matches anything in the schema. That is not a refusal — the
  // probe is calling nothing, so it would pass forever without testing
  // anything.
  if (code === "PGRST202") {
    return {
      table: `rpc ${fn}`,
      ok: false,
      detail: "function is missing or its signature changed; fix the probe",
    };
  }
  if (response.status >= 400) {
    return { table: `rpc ${fn}`, ok: true, detail: `refused (${response.status})` };
  }
  return { table: `rpc ${fn}`, ok: false, detail: `ACCEPTED an anonymous call (${response.status})` };
}
