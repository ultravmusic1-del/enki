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
  "outbound_clicks",
  "profiles",
  "reviews",
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
