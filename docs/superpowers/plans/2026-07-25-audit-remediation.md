# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security, integrity, and data-hygiene findings from the 2026-07-25 senior code audit so Enki is safe to deploy publicly.

**Architecture:** Defence in depth, database-first. The Postgres layer becomes the authority for moderation state (column grants + triggers + a self-guarding `SECURITY DEFINER` RPC), the Next server actions gain their own admin gate so unauthorized callers cannot trigger side effects, and the presentation layer stops emitting fabricated trust signals (verified badges, helpful counts, synthesized histograms, and schema.org rating markup) that Enki cannot substantiate.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript strict, Supabase (Postgres + RLS + PostgREST), Zod v4, Vitest.

---

## Context: the findings this plan closes

| # | Severity | Finding |
|---|---|---|
| 1 | HIGH | Any signed-in user can rewrite `reviews.status` (self-approve a rejected review) — no column-level write restriction and `setReviewStatus` has no admin check |
| 2 | HIGH | No `pending` state exists; `status` defaults to `'approved'` so reviews publish instantly, contradicting the documented moderation model |
| 3 | MEDIUM | All four admin server actions lack an auth gate; `deleteTool` lets an anonymous caller force a ~181-route revalidation (denial-of-wallet) |
| 4 | MEDIUM | Fabricated trust signals: "Verified reviewer" badges, invented "helpful" counts, a synthesized star histogram, and schema.org `AggregateRating`/`Review` markup built from seed data |
| 5 | MEDIUM | Anon-insert tables have no DB-level length validation and no bot deterrent |
| 6 | LOW | Raw Postgres errors surface to users; seed validation is skipped in production builds; `admin_click_stats` is anon-callable; `profiles.display_name` is unbounded; `middleware.ts` deprecation; stale docs |

**Deliberate non-goals** (escalated to the operator, not fixed in code):

- The seed `rating` / `reviewCount` figures on tools and the six fictional editorial personas in `src/data/authors.ts`. Removing these guts the directory UI and is a product/editorial decision, not an engineering one. This plan removes the *unsubstantiable machine-readable claims* and the *fabricated engagement metrics* built on top of them, and records the remaining decision in `handoff.md`.
- Rate limiting at the edge (Vercel WAF / firewall rules) — infrastructure config, added to the deploy checklist. A per-instance in-memory limiter would be worse than none on serverless.
- A nonce-based CSP — already tracked as its own follow-up in `next.config.ts`.

---

## File structure

**Database (Supabase migrations, applied via the MCP `apply_migration` tool):**
- `harden_review_moderation` — pending status, own-row read policy, column grants, enforcement trigger, admin RPC
- `harden_public_input` — length CHECKs on `tool_submissions` / `subscribers` / `profiles`, revoke anon EXECUTE on `admin_click_stats`

**Created:**
- `src/components/shared/honeypot.tsx` — shared hidden bot-trap field
- `src/lib/admin.test.ts` — tests for the admin gate
- `src/app/admin/actions.test.ts` — tests for review/submission moderation guards
- `src/app/admin/tools/actions.test.ts` — tests for the tool CMS guards
- `src/test/supabase-stub.ts` — reusable chainable Supabase mock for action tests

**Modified:**
- `src/lib/admin.ts` — add non-redirecting `assertAdmin`; `requireAdmin` delegates to it
- `src/app/admin/actions.ts` — admin gate, RPC-based status write, friendly errors
- `src/app/admin/tools/actions.ts` — admin gate, affected-row checks, friendly errors
- `src/app/actions/newsletter.ts`, `src/app/submit/actions.ts` — honeypot check, friendly errors
- `src/lib/schemas.ts` — drop `helpful`/`verified`, add honeypot field
- `src/data/reviews.ts` — strip `helpful`/`verified` from 23 entries
- `src/lib/content.ts` — always-strict seed validation, drop `getRatingDistribution`, date-only review sort
- `src/lib/site.ts` — add `hasVerifiedRatings` flag
- `src/lib/structured-data.ts` — gate `aggregateRating` / `review` behind the flag
- `src/components/detail/review-list.tsx` — remove verified badge + helpful count
- `src/components/detail/community-reviews.tsx` — pending-review handling
- `src/components/detail/review-modal.tsx` — "submitted for review" copy
- `src/components/submit/submit-form.tsx`, `src/components/layout/site-footer.tsx` — honeypot
- `src/app/admin/page.tsx` — pending-reviews KPI
- `src/app/admin/moderation-actions.tsx` — include `pending` in the option set
- `src/app/tools/[slug]/page.tsx` — remove synthesized distribution block
- `src/lib/content.test.ts`, `src/lib/structured-data.test.ts` — update for the above
- `src/middleware.ts` → `src/proxy.ts` — Next 16 rename
- `handoff.md` — correct the moderation/architecture claims, add operator decisions

**Deleted:**
- `src/components/detail/rating-distribution.tsx`

---

## Task 1: Database — review moderation integrity

**Files:**
- Migration (via Supabase MCP `apply_migration`, name: `harden_review_moderation`)

- [ ] **Step 1: Verify current state before changing it**

Run via the Supabase MCP `execute_sql` tool on project `qknsqurdawglctwqfwxe`:

```sql
select status, count(*) from public.reviews group by status;
```

Expected: a small number of rows (or zero rows if no reviews exist yet). Record the counts — existing rows keep their current status; only the default changes.

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool, name `harden_review_moderation`:

```sql
-- 1. Add the 'pending' state and make it the default for new reviews.
alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews add constraint reviews_status_check
  check (status in ('pending', 'approved', 'flagged', 'rejected'));
alter table public.reviews alter column status set default 'pending';

-- 2. Authors must be able to read their own not-yet-approved review, or the
--    supabase-js upsert (which returns a representation) fails under RLS and
--    the review appears to vanish after submitting.
drop policy if exists "Users can read their own reviews" on public.reviews;
create policy "Users can read their own reviews"
  on public.reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Column-level write privileges. A table-level grant covers every column,
--    and Postgres will NOT let a column-level revoke override it, so the
--    table-level grant must be dropped first and the safe columns re-granted.
--    `status` is deliberately absent: only the admin RPC below can set it.
revoke insert, update on public.reviews from anon, authenticated;
grant insert (tool_slug, user_id, rating, title, body, updated_at)
  on public.reviews to authenticated;
grant update (rating, title, body, updated_at)
  on public.reviews to authenticated;

-- 4. Trigger enforcement. Grants are the outer wall; this is the real gate and
--    survives a future grant mistake. Editing a review's content sends it back
--    to the moderation queue.
create or replace function public.enforce_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Admins (and the admin RPC, which runs on their behalf) set status freely.
  if public.is_admin() then
    return new;
  end if;

  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.status := 'pending';
  elsif tg_op = 'UPDATE' then
    if new.rating   is distinct from old.rating
    or new.title    is distinct from old.title
    or new.body     is distinct from old.body then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_review_moderation on public.reviews;
create trigger enforce_review_moderation
  before insert or update on public.reviews
  for each row execute function public.enforce_review_moderation();

-- 5. The only path that may set a moderation status. Self-guards with
--    is_admin() so calling it directly over PostgREST as a non-admin is inert.
create or replace function public.admin_set_review_status(
  review_id uuid,
  new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected int;
begin
  if not public.is_admin() then
    return false;
  end if;

  if new_status not in ('pending', 'approved', 'flagged', 'rejected') then
    raise exception 'invalid review status: %', new_status using errcode = '22023';
  end if;

  update public.reviews
     set status = new_status,
         updated_at = now()
   where id = review_id;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.admin_set_review_status(uuid, text) from anon;
```

- [ ] **Step 3: Verify the grants and default landed**

Run via `execute_sql`:

```sql
select column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'reviews'
   and grantee = 'authenticated'
   and privilege_type in ('INSERT', 'UPDATE')
 order by privilege_type, column_name;
```

Expected: `INSERT` on `body, rating, title, tool_slug, updated_at, user_id` and `UPDATE` on `body, rating, title, updated_at`. **`status` must not appear in either list.**

- [ ] **Step 4: Prove the bypass is closed**

Run via `execute_sql`. This simulates a signed-in non-admin attacking their own row:

```sql
do $$
declare
  uid uuid;
  rid uuid;
  final_status text;
begin
  select id into uid from auth.users limit 1;
  if uid is null then
    raise notice 'SKIP: no auth users to test with';
    return;
  end if;

  insert into public.reviews (tool_slug, user_id, rating, title, body, status)
  values ('cursor', uid, 5, 'audit probe', 'audit probe', 'approved')
  returning id into rid;

  select status into final_status from public.reviews where id = rid;
  raise notice 'INSERT forced status to: %  (expected: pending)', final_status;

  update public.reviews set status = 'approved' where id = rid;
  select status into final_status from public.reviews where id = rid;
  raise notice 'UPDATE left status as: %  (expected: pending)', final_status;

  delete from public.reviews where id = rid;
end $$;
```

Expected notices: `INSERT forced status to: pending` and `UPDATE left status as: pending`.

Note: this runs as the migration role, for which `is_admin()` is false (there is no JWT), so it exercises exactly the non-admin path. The probe row is deleted at the end.

- [ ] **Step 5: Regenerate the TypeScript database types**

Use the Supabase MCP `generate_typescript_types` tool and write the result over `src/lib/supabase/database.types.ts`. This is what makes `supabase.rpc("admin_set_review_status", ...)` type-check in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/database.types.ts && git commit -m "feat(db): enforce review moderation at the database layer

Reviews now default to 'pending' and only an admin-guarded RPC can set a
moderation status. Column-level grants plus a BEFORE INSERT/UPDATE trigger
stop a signed-in user from self-approving their own review over PostgREST."
```

---

## Task 2: Database — public input hardening

**Files:**
- Migration (via Supabase MCP `apply_migration`, name: `harden_public_input`)

- [ ] **Step 1: Check existing rows would satisfy the new constraints**

Run via `execute_sql`:

```sql
select
  (select count(*) from public.tool_submissions
    where char_length(name) > 80
       or char_length(url) > 2048
       or char_length(coalesce(pitch, '')) > 500
       or char_length(coalesce(category_slug, '')) > 64
       or char_length(coalesce(submitter_email, '')) > 254) as bad_submissions,
  (select count(*) from public.subscribers
    where char_length(email) not between 3 and 254
       or email not like '%_@_%.__%') as bad_subscribers,
  (select count(*) from public.profiles
    where char_length(display_name) not between 1 and 60) as bad_profiles;
```

Expected: `0, 0, 0`. If any count is non-zero, clean or widen the bound before continuing — do not force the constraint on existing data.

- [ ] **Step 2: Apply the migration**

Use `apply_migration`, name `harden_public_input`:

```sql
-- Mirror the Zod limits in the database. The anon key is public, so the app's
-- validation is a courtesy; only these constraints bind a direct REST caller.
alter table public.tool_submissions
  add constraint tool_submissions_name_check
    check (char_length(name) between 1 and 80),
  add constraint tool_submissions_url_check
    check (char_length(url) between 1 and 2048),
  add constraint tool_submissions_pitch_check
    check (pitch is null or char_length(pitch) <= 500),
  add constraint tool_submissions_category_slug_check
    check (category_slug is null or char_length(category_slug) <= 64),
  add constraint tool_submissions_submitter_email_check
    check (submitter_email is null or char_length(submitter_email) <= 254);

alter table public.subscribers
  add constraint subscribers_email_check
    check (char_length(email) between 3 and 254 and email like '%_@_%.__%');

alter table public.profiles
  add constraint profiles_display_name_check
    check (char_length(display_name) between 1 and 60);

-- admin_click_stats self-guards with is_admin(), but there is no reason for an
-- unauthenticated caller to reach it at all.
-- is_admin() is deliberately NOT revoked: it is referenced by RLS policies on
-- five tables, and it only ever reveals whether *you* are an admin.
revoke execute on function public.admin_click_stats(integer) from anon;
```

- [ ] **Step 3: Verify the constraints reject oversized input**

Run via `execute_sql`:

```sql
do $$
begin
  begin
    insert into public.subscribers (email) values (repeat('a', 300) || '@x.com');
    raise notice 'FAIL: oversized subscriber email was accepted';
  exception when check_violation then
    raise notice 'PASS: oversized subscriber email rejected';
  end;

  begin
    insert into public.tool_submissions (name, url)
    values (repeat('a', 200), 'https://example.com');
    raise notice 'FAIL: oversized submission name was accepted';
  exception when check_violation then
    raise notice 'PASS: oversized submission name rejected';
  end;
end $$;
```

Expected: two `PASS:` notices.

- [ ] **Step 4: Re-run the security advisors**

Use the Supabase MCP `get_advisors` tool with `type: "security"`.

Expected: the `anon_security_definer_function_executable` entry for `admin_click_stats` is gone. The `rls_policy_always_true` INSERT warnings for `outbound_clicks` / `subscribers` / `tool_submissions` remain by design (public forms must accept anonymous writes) and are now bounded by the CHECK constraints above.

- [ ] **Step 5: Commit**

No source files change in this task; the migration lives in Supabase. Record it in the next commit.

---

## Task 3: The non-redirecting admin gate

**Files:**
- Modify: `src/lib/admin.ts`
- Create: `src/test/supabase-stub.ts`
- Test: `src/lib/admin.test.ts`

- [ ] **Step 1: Write the reusable Supabase stub**

Create `src/test/supabase-stub.ts`:

```ts
import { vi } from "vitest";

export type StubResult = { data?: unknown; error?: unknown; count?: number };

/**
 * A chainable stand-in for a supabase-js query builder. Every builder method
 * returns the same object, and the object is a thenable that resolves to the
 * configured result — which is exactly how the real lazy builders behave.
 */
export function queryStub(result: StubResult) {
  const stub: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const method of methods) {
    stub[method] = vi.fn(() => stub);
  }
  stub.then = (onOk: (v: StubResult) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onOk, onErr);
  return stub as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<StubResult>;
}

export type SupabaseStubOptions = {
  /** The signed-in user, or null for a signed-out caller. */
  user?: { id: string } | null;
  /** What the `is_admin` RPC resolves to. */
  isAdmin?: boolean;
  /** An error from the `is_admin` RPC (takes precedence over isAdmin). */
  isAdminError?: unknown;
  /** Result for any `.from(...)` chain. */
  table?: StubResult;
  /** Results for named RPCs other than `is_admin`. */
  rpc?: Record<string, StubResult>;
};

/** Build a Supabase client stub good enough for the server actions under test. */
export function supabaseStub(options: SupabaseStubOptions = {}) {
  const {
    user = { id: "user-1" },
    isAdmin = true,
    isAdminError = null,
    table = { data: [], error: null },
    rpc = {},
  } = options;

  const builder = queryStub(table);

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn(() => builder),
    rpc: vi.fn(async (name: string) => {
      if (name === "is_admin") {
        return { data: isAdminError ? null : isAdmin, error: isAdminError };
      }
      return rpc[name] ?? { data: null, error: null };
    }),
  };

  return Object.assign(client, { builder });
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const { assertAdmin, requireAdmin } = await import("@/lib/admin");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin: assertAdmin", () => {
  it("returns the user id for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ user: { id: "u-9" }, isAdmin: true }));
    await expect(assertAdmin()).resolves.toEqual({ ok: true, userId: "u-9" });
  });

  it("reports unauthenticated when there is no session", async () => {
    createClient.mockReturnValue(supabaseStub({ user: null }));
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "unauthenticated" });
  });

  it("reports forbidden for a signed-in non-admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("fails closed when the admin check itself errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdminError: { message: "connection refused" } }),
    );
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("never leaks the underlying error to the caller", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdminError: { message: "connection refused" } }),
    );
    const result = await assertAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("connection refused");
  });
});

describe("admin: requireAdmin", () => {
  it("sends a signed-out visitor to the login page", async () => {
    createClient.mockReturnValue(supabaseStub({ user: null }));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login?redirect=/admin");
  });

  it("sends a signed-in non-admin home", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("returns the user id for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ user: { id: "u-3" }, isAdmin: true }));
    await expect(requireAdmin()).resolves.toBe("u-3");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/lib/admin.test.ts
```

Expected: FAIL — `assertAdmin` is not exported from `@/lib/admin`.

- [ ] **Step 4: Implement it**

Replace the whole of `src/lib/admin.ts`:

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminCheck =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "unavailable";
      error: string;
    };

/**
 * Resolve whether the caller is an admin, without redirecting.
 *
 * Server actions are publicly invokable POST endpoints, so every admin action
 * must call this itself — RLS stops an unauthorized *write*, but it cannot stop
 * an unauthorized caller from reaching the action and triggering its side
 * effects (cache invalidation, revalidation of every route).
 *
 * Fails closed: an unreachable database is "not an admin".
 */
export async function assertAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      error: "You need to be signed in to do that.",
    };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("[enki] is_admin check failed", error);
    return {
      ok: false,
      reason: "unavailable",
      error: "Could not verify your access. Try again in a moment.",
    };
  }
  if (!isAdmin) {
    return {
      ok: false,
      reason: "forbidden",
      error: "Admin access is required for that.",
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * Page-level admin gate. Defence in depth: RLS is the real authority over the
 * data, this keeps non-admins out of the UI and gives them a destination.
 *
 * Returns the admin's user id; never returns for anyone else.
 */
export async function requireAdmin(): Promise<string> {
  const check = await assertAdmin();
  if (!check.ok) {
    redirect(check.reason === "unauthenticated" ? "/login?redirect=/admin" : "/");
  }
  return check.userId;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/lib/admin.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin.ts src/lib/admin.test.ts src/test/supabase-stub.ts
git commit -m "feat(admin): add a non-redirecting assertAdmin gate for server actions"
```

---

## Task 4: Gate the review + submission moderation actions

**Files:**
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/moderation-actions.tsx`
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/admin/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const { setReviewStatus, setSubmissionStatus } = await import("@/app/admin/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin actions: setReviewStatus", () => {
  it("rejects a status outside the whitelist", async () => {
    createClient.mockReturnValue(supabaseStub());
    // @ts-expect-error deliberately invalid status
    const res = await setReviewStatus("r-1", "published");
    expect(res.ok).toBe(false);
  });

  it("refuses a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await setReviewStatus("r-1", "approved");
    expect(res.ok).toBe(false);
  });

  it("does not revalidate anything for a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await setReviewStatus("r-1", "approved");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("writes through the guarded RPC, never a direct table update", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_set_review_status: { data: true, error: null } },
    });
    createClient.mockReturnValue(stub);

    const res = await setReviewStatus("r-1", "approved");

    expect(res.ok).toBe(true);
    expect(stub.rpc).toHaveBeenCalledWith("admin_set_review_status", {
      review_id: "r-1",
      new_status: "approved",
    });
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("reports a miss when the RPC matched no row", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_set_review_status: { data: false, error: null } },
      }),
    );
    const res = await setReviewStatus("nope", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts the pending status", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_set_review_status: { data: true, error: null } },
      }),
    );
    await expect(setReviewStatus("r-1", "pending")).resolves.toMatchObject({ ok: true });
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: {
          admin_set_review_status: {
            data: null,
            error: { message: 'relation "reviews" does not exist' },
          },
        },
      }),
    );
    const res = await setReviewStatus("r-1", "approved");
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain("relation");
  });
});

describe("admin actions: setSubmissionStatus", () => {
  it("refuses a non-admin caller and revalidates nothing", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await setSubmissionStatus("s-1", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the admin page after a real update", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } }),
    );
    const res = await setSubmissionStatus("s-1", "approved");
    expect(res.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("reports a miss when no submission row matched", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [], error: null } }),
    );
    const res = await setSubmissionStatus("gone", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/app/admin/actions.test.ts
```

Expected: FAIL — the actions currently accept non-admin callers and update the table directly.

- [ ] **Step 3: Implement it**

Replace the whole of `src/app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

const REVIEW_STATUSES = ["pending", "approved", "flagged", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Set a review's moderation status.
 *
 * Authorization is checked three times over: here (so an unauthorized caller
 * cannot trigger a revalidation), inside `admin_set_review_status` (which
 * self-guards with is_admin()), and by the column grants that stop `status`
 * being written any other way.
 */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  if (!REVIEW_STATUSES.includes(status)) {
    return { ok: false as const, error: "That is not a valid review status." };
  }

  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_review_status", {
    review_id: id,
    new_status: status,
  });

  if (error) {
    console.error("[enki] admin_set_review_status failed", error);
    return { ok: false as const, error: "Could not update the review." };
  }
  if (!data) {
    return { ok: false as const, error: "That review no longer exists." };
  }

  revalidatePath("/admin");
  return { ok: true as const };
}

const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Set a tool submission's status. RLS restricts the write to admins; the gate
 * here stops an unauthorized caller from reaching the revalidation below.
 */
export async function setSubmissionStatus(id: string, status: SubmissionStatus) {
  if (!SUBMISSION_STATUSES.includes(status)) {
    return { ok: false as const, error: "That is not a valid submission status." };
  }

  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_submissions")
    .update({ status })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[enki] submission status update failed", error);
    return { ok: false as const, error: "Could not update the submission." };
  }
  if (!data || data.length === 0) {
    return { ok: false as const, error: "That submission no longer exists." };
  }

  revalidatePath("/admin");
  return { ok: true as const };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/app/admin/actions.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Expose "pending" in the moderation UI**

In `src/app/admin/moderation-actions.tsx`, replace the `OPTIONS` constant:

```tsx
const OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "pending", label: "Hold" },
  { value: "flagged", label: "Flag" },
  { value: "rejected", label: "Reject" },
];
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts src/app/admin/moderation-actions.tsx
git commit -m "fix(admin): gate moderation actions and route status writes through the guarded RPC

Server actions are public POST endpoints. Without an explicit gate a non-admin
could invoke setReviewStatus on their own review (the owner RLS policy matched)
and could trigger admin-only revalidation."
```

---

## Task 5: Gate the tool CMS actions

**Files:**
- Modify: `src/app/admin/tools/actions.ts`
- Test: `src/app/admin/tools/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/admin/tools/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";
import { tools } from "@/data/tools";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const invalidateToolCache = vi.fn();
vi.mock("@/lib/content", () => ({ invalidateToolCache: () => invalidateToolCache() }));

const { saveTool, deleteTool } = await import("@/app/admin/tools/actions");

const validToolJson = JSON.stringify(tools[0]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tool CMS actions: deleteTool", () => {
  it("refuses a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await deleteTool("cursor");
    expect(res.ok).toBe(false);
  });

  it("does not invalidate caches or revalidate for a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await deleteTool("cursor");
    expect(invalidateToolCache).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not revalidate when no row was deleted", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [], error: null } }),
    );
    const res = await deleteTool("not-in-db");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the whole app after a real delete", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [{ slug: "cursor" }], error: null } }),
    );
    const res = await deleteTool("cursor");
    expect(res.ok).toBe(true);
    expect(invalidateToolCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("tool CMS actions: saveTool", () => {
  it("refuses a non-admin caller before parsing the payload", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await saveTool(validToolJson, true);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const res = await saveTool("{ not json", true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("JSON");
  });

  it("rejects a payload that fails the tool schema", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const res = await saveTool(JSON.stringify({ slug: "x" }), true);
    expect(res.ok).toBe(false);
  });

  it("saves a valid tool and revalidates", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [{ slug: tools[0].slug }], error: null } }),
    );
    const res = await saveTool(validToolJson, true);
    expect(res).toMatchObject({ ok: true, slug: tools[0].slug });
    expect(invalidateToolCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        table: { data: null, error: { message: 'duplicate key value violates "tools_pkey"' } },
      }),
    );
    const res = await saveTool(validToolJson, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("tools_pkey");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/app/admin/tools/actions.test.ts
```

Expected: FAIL — `deleteTool` currently revalidates for any caller.

- [ ] **Step 3: Implement it**

Replace the whole of `src/app/admin/tools/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { toolSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { invalidateToolCache } from "@/lib/content";

/**
 * Revalidating the whole app is expensive (it re-renders ~180 routes and reads
 * the database for each). Only ever do it after a write that actually changed
 * something, and only for a verified admin — otherwise the action doubles as a
 * free cache-busting endpoint for anyone who can send a POST.
 */
function revalidateEverything() {
  invalidateToolCache();
  revalidatePath("/", "layout");
}

/**
 * Create or update a tool. The full object is validated against toolSchema
 * (the single content contract), then written to the `tools` table. RLS
 * enforces admin-only writes; the read layer merges it over the seed.
 */
export async function saveTool(rawJson: string, published: boolean) {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false as const, error: "Invalid JSON — check for typos." };
  }

  const result = toolSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false as const, error: z.prettifyError(result.error) };
  }

  const tool = result.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tools")
    .upsert({
      slug: tool.slug,
      data: tool,
      published,
      updated_at: new Date().toISOString(),
    })
    .select("slug");

  if (error) {
    console.error("[enki] saveTool failed", error);
    return { ok: false as const, error: "Could not save the tool. Try again." };
  }
  if (!data || data.length === 0) {
    return {
      ok: false as const,
      error: "The save did not apply. Check your admin access and try again.",
    };
  }

  revalidateEverything();
  return { ok: true as const, slug: tool.slug };
}

/** Remove a tool's DB row — it reverts to the seed version if one exists. */
export async function deleteTool(slug: string) {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tools")
    .delete()
    .eq("slug", slug)
    .select("slug");

  if (error) {
    console.error("[enki] deleteTool failed", error);
    return { ok: false as const, error: "Could not delete the tool. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false as const, error: "There is no database row for that tool." };
  }

  revalidateEverything();
  return { ok: true as const };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/app/admin/tools/actions.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tools/actions.ts src/app/admin/tools/actions.test.ts
git commit -m "fix(admin): gate tool CMS actions and only revalidate on a real write

deleteTool previously ran invalidateToolCache + revalidatePath('/', 'layout')
for any caller whose delete matched zero rows, making it a free way to force a
~180-route rebuild."
```

---

## Task 6: Honeypot + honest errors on the public write paths

**Files:**
- Create: `src/components/shared/honeypot.tsx`
- Modify: `src/lib/schemas.ts`
- Modify: `src/app/actions/newsletter.ts`
- Modify: `src/app/submit/actions.ts`
- Modify: `src/components/submit/submit-form.tsx`
- Modify: `src/components/layout/site-footer.tsx`
- Test: `src/lib/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { newsletterSchema, submissionFormSchema } from "@/lib/schemas";

describe("schemas: newsletter", () => {
  it("accepts a valid email with the honeypot left empty", () => {
    expect(newsletterSchema.safeParse({ email: "a@example.com", hp: "" }).success).toBe(true);
  });

  it("accepts a valid email with no honeypot key at all", () => {
    expect(newsletterSchema.safeParse({ email: "a@example.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(newsletterSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("caps the email length so a bot cannot post a megabyte", () => {
    const long = `${"a".repeat(300)}@example.com`;
    expect(newsletterSchema.safeParse({ email: long }).success).toBe(false);
  });
});

describe("schemas: submission", () => {
  const valid = { name: "Acme AI", url: "https://acme.example.com" };

  it("accepts a minimal valid submission", () => {
    expect(submissionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("keeps the honeypot optional and unvalidated for humans", () => {
    expect(submissionFormSchema.safeParse({ ...valid, hp: "" }).success).toBe(true);
  });

  it("rejects an over-long pitch", () => {
    expect(
      submissionFormSchema.safeParse({ ...valid, pitch: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects a non-URL website", () => {
    expect(submissionFormSchema.safeParse({ ...valid, url: "acme" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/schemas.test.ts
```

Expected: FAIL — the newsletter schema has no length cap and neither schema has an `hp` field.

- [ ] **Step 3: Add the honeypot to the schemas**

In `src/lib/schemas.ts`, replace the newsletter and submission sections (everything from `/* -------------------------------------------------- newsletter form (footer) */` to the end of the file):

```ts
/* -------------------------------------------------- newsletter form (footer) */

/**
 * Hidden bot-trap field. Never shown to a human, so any value at all means the
 * submitter is automated. It is `optional()` and never fails validation — the
 * server actions decide what to do with it, so a bot gets a normal-looking
 * success rather than a signal that it was detected.
 */
const honeypot = z.string().optional();

export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  hp: honeypot,
});

export type NewsletterValues = z.infer<typeof newsletterSchema>;

/* ------------------------------------------------ submit-a-tool form */

export const submissionFormSchema = z.object({
  name: z.string().min(1, "Enter the tool's name").max(80),
  url: z.url("Enter a valid URL, including https://").max(2048),
  categorySlug: z.string().max(64).optional(),
  pitch: z.string().max(500, "Keep the pitch under 500 characters").optional(),
  submitterEmail: z
    .union([z.email("Enter a valid email").max(254), z.literal("")])
    .optional(),
  hp: honeypot,
});

export type SubmissionValues = z.infer<typeof submissionFormSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/schemas.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Create the shared honeypot field**

Create `src/components/shared/honeypot.tsx`:

```tsx
/**
 * A bot trap. Positioned off-screen rather than `display: none` because many
 * form-filling bots skip hidden inputs but not offset ones. Removed from the
 * tab order and the accessibility tree, so a human never encounters it.
 *
 * Pair with a server-side check: a non-empty value means "silently discard".
 */
export function Honeypot({
  register,
}: {
  register: Record<string, unknown>;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="enki-hp">Leave this field empty</label>
      <input
        id="enki-hp"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        {...register}
      />
    </div>
  );
}
```

- [ ] **Step 6: Check the honeypot in the newsletter action**

Replace the whole of `src/app/actions/newsletter.ts`:

```ts
"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import { newsletterSchema } from "@/lib/schemas";

/**
 * Record a newsletter subscription. Validated server-side; written with the
 * anonymous client (RLS allows insert only — the list is admin-read). Duplicate
 * emails are ignored so re-subscribing is a friendly no-op rather than an error.
 */
export async function subscribe(email: string, hp?: string) {
  // A filled honeypot means a bot. Report success so it learns nothing.
  if (hp) return { ok: true as const };

  const parsed = newsletterSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const supabase = createAnonClient();
  // Plain insert (return=minimal) so no SELECT is needed — the list is
  // admin-read only. A duplicate email is a friendly no-op, not an error.
  const { error } = await supabase
    .from("subscribers")
    .insert({ email: parsed.data.email.toLowerCase() });

  if (error) {
    if (error.code === "23505") return { ok: true as const }; // already subscribed
    console.error("[enki] newsletter subscribe failed", error);
    return { ok: false as const, error: "Could not subscribe you. Try again." };
  }
  return { ok: true as const };
}
```

- [ ] **Step 7: Check the honeypot in the submit action**

Replace the whole of `src/app/submit/actions.ts`:

```ts
"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import { submissionFormSchema, type SubmissionValues } from "@/lib/schemas";

/**
 * Record a public tool submission. Validated server-side with the same Zod
 * schema the form uses; written with the anonymous client (RLS allows insert
 * only — nobody but an admin can read the queue back). Length limits are
 * mirrored as CHECK constraints in Postgres, since the anon key is public and
 * a direct REST caller never runs this code.
 */
export async function submitTool(values: SubmissionValues) {
  // A filled honeypot means a bot. Report success so it learns nothing.
  if (values.hp) return { ok: true as const };

  const parsed = submissionFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false as const, error: "Please check the form and try again." };
  }

  const v = parsed.data;
  const supabase = createAnonClient();
  const { error } = await supabase.from("tool_submissions").insert({
    name: v.name.trim(),
    url: v.url.trim(),
    category_slug: v.categorySlug || null,
    pitch: v.pitch?.trim() || null,
    submitter_email: v.submitterEmail?.trim() || null,
  });

  if (error) {
    console.error("[enki] tool submission failed", error);
    return { ok: false as const, error: "Could not send your submission. Try again." };
  }
  return { ok: true as const };
}
```

- [ ] **Step 8: Wire the honeypot into the submit form**

In `src/components/submit/submit-form.tsx`:

Add the import after the existing `Icon` import:

```tsx
import { Honeypot } from "@/components/shared/honeypot";
```

Change the `defaultValues` object to include the field:

```tsx
    defaultValues: {
      name: "",
      url: "",
      categorySlug: "",
      pitch: "",
      submitterEmail: "",
      hp: "",
    },
```

Add `relative` to the form's class list so the off-screen field is positioned against it, and render the trap as the form's first child:

```tsx
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="glass ring-hairline relative flex flex-col gap-4 rounded-2xl border border-border p-6 sm:p-8"
      noValidate
    >
      <Honeypot register={register("hp")} />

      <Field label="Tool name" error={errors.name?.message}>
```

- [ ] **Step 9: Wire the honeypot into the footer newsletter form**

In `src/components/layout/site-footer.tsx`:

Add the import alongside the other component imports:

```tsx
import { Honeypot } from "@/components/shared/honeypot";
```

Change `defaultValues` to include the field:

```tsx
    defaultValues: { email: "", hp: "" },
```

Pass it through to the action:

```tsx
  const onSubmit = async (values: NewsletterValues) => {
    const res = await subscribe(values.email, values.hp);
```

Add `relative` to the form and render the trap first:

```tsx
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="relative flex flex-col gap-2"
              noValidate
            >
              <Honeypot register={register("hp")} />
              <div className="flex gap-2">
```

- [ ] **Step 10: Verify the gates**

```bash
npm run typecheck && npm run lint && npx vitest run
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/shared/honeypot.tsx src/lib/schemas.ts src/lib/schemas.test.ts src/app/actions/newsletter.ts src/app/submit/actions.ts src/components/submit/submit-form.tsx src/components/layout/site-footer.tsx
git commit -m "feat(forms): add honeypot bot traps and stop leaking database errors

Public write paths now cap input length in Zod (mirrored as Postgres CHECK
constraints) and return a friendly message while logging the real error."
```

---

## Task 7: Pending-review UX

**Files:**
- Modify: `src/components/detail/community-reviews.tsx`
- Modify: `src/components/detail/review-modal.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Show pending reviews to their author, and keep them out of the average**

In `src/components/detail/community-reviews.tsx`, add `status` to the `Row` type:

```tsx
type Row = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  user_id: string;
  status: string;
  display_name: string;
};
```

Add `status` to the select in `load`:

```tsx
    const { data: revs } = await supabase
      .from("reviews")
      .select("id, rating, title, body, created_at, user_id, status")
      .eq("tool_slug", toolSlug)
      .order("created_at", { ascending: false });
```

Replace the `summary` memo so only approved reviews count toward the public average — RLS returns the viewer's own pending review too, and one person's unmoderated rating must not move the number everyone sees:

```tsx
  // Only approved reviews count toward the public average. RLS also returns the
  // viewer's own pending review, which must not move the number others see.
  const summary = useMemo(
    () => summarizeReviews(reviews.filter((r) => r.status === "approved")),
    [reviews],
  );
```

Add a pending chip next to the star rating inside the review card, replacing the existing `<StarRating value={r.rating} size={13} />` line:

```tsx
            <span className="flex items-center gap-2">
              {r.status !== "approved" && (
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                  Awaiting review
                </span>
              )}
              <StarRating value={r.rating} size={13} />
            </span>
```

- [ ] **Step 2: Tell the author their review is queued**

In `src/components/detail/review-modal.tsx`, replace the success toast:

```tsx
    toast.success("Review submitted", {
      description: `Thanks for reviewing ${toolName}. An editor will publish it shortly.`,
    });
```

- [ ] **Step 3: Surface the pending queue depth in the admin dashboard**

In `src/app/admin/page.tsx`, add a pending-review count to the parallel fetch. Insert this entry into the destructured array and the `Promise.all` list, immediately after the existing `{ count: reviewCount }` entry:

Destructuring:

```tsx
  const [
    { data: stats },
    { count: reviewCount },
    { count: pendingReviewCount },
    { data: reviews },
    { data: submissions },
    { count: subscriberCount },
  ] = await Promise.all([
```

Query list (immediately after the existing `reviews` count query):

```tsx
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
```

Replace the `Reviews` KPI tile with two tiles:

```tsx
          <Kpi label="Reviews" value={String(reviewCount ?? 0)} />
          <Kpi label="Pending reviews" value={String(pendingReviewCount ?? 0)} />
```

Change the KPI grid to fit six tiles:

```tsx
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border ring-hairline md:grid-cols-6">
```

- [ ] **Step 4: Verify the gates**

```bash
npm run typecheck && npm run lint && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/detail/community-reviews.tsx src/components/detail/review-modal.tsx src/app/admin/page.tsx
git commit -m "feat(reviews): pre-moderation UX for pending community reviews

Authors see their own queued review labelled 'Awaiting review'; only approved
reviews contribute to the public average; the admin dashboard shows the queue."
```

---

## Task 8: Remove fabricated engagement signals

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/data/reviews.ts`
- Modify: `src/lib/content.ts`
- Modify: `src/components/detail/review-list.tsx`
- Modify: `src/lib/content.test.ts`
- Delete: `src/components/detail/rating-distribution.tsx`
- Modify: `src/app/tools/[slug]/page.tsx`

- [ ] **Step 1: Drop the fabricated fields from the review schema**

In `src/lib/schemas.ts`, replace the `reviewSchema` definition:

```ts
export const reviewSchema = z.object({
  id: z.string().min(1),
  toolSlug: slug,
  authorId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1),
  body: z.string().min(1),
  /** ISO date string, e.g. 2025-11-03. */
  date: z.iso.date(),
});
```

`helpful` and `verified` are gone: an invented "N found this helpful" count and a "verified reviewer" badge are trust signals Enki cannot substantiate, and inventing them on a monetized review site is exactly what the FTC's fake-review rule (16 CFR Part 465) prohibits.

- [ ] **Step 2: Strip the fields from the seed data**

Run this one-off script from the repo root:

```bash
node -e "const fs=require('fs');const p='src/data/reviews.ts';const s=fs.readFileSync(p,'utf8');const out=s.split('\n').filter(l=>!/^\s*(helpful|verified):/.test(l)).join('\n');fs.writeFileSync(p,out);console.log('stripped')"
```

Expected output: `stripped`

Then update the file's header comment (lines 3-8) to drop the reference to the synthesized distribution:

```ts
/**
 * Authored editorial reviews. We write a handful for notable tools rather than
 * thousands. These add human texture on detail pages; the aggregate
 * `rating`/`reviewCount` live on the tool itself.
 */
```

- [ ] **Step 3: Verify no references remain**

```bash
npx tsc --noEmit
```

Expected: FAIL, with errors in `src/lib/content.ts`, `src/components/detail/review-list.tsx`, and `src/lib/content.test.ts` referencing `helpful` / `verified` / `getRatingDistribution`. Those are fixed next.

- [ ] **Step 4: Update the content layer**

In `src/lib/content.ts`, change the sort in `getReviewsForTool` to date-only:

```ts
export function getReviewsForTool(slug: string): ReviewWithAuthor[] {
  return reviews
    .filter((r) => r.toolSlug === slug)
    .map((r) => ({ ...r, author: getAuthorById(r.authorId) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
```

Then delete the entire `getRatingDistribution` function (from the `/**\n * Synthesize a plausible 5-bucket star distribution...` doc comment through its closing `}`). A histogram invented from an aggregate is presented to users as a breakdown of real ratings; it is not one.

- [ ] **Step 5: Update the review list component**

Replace the whole of `src/components/detail/review-list.tsx`:

```tsx
import type { ReviewWithAuthor } from "@/lib/content";
import { StarRating } from "@/components/shared/star-rating";
import { Monogram } from "@/components/shared/monogram";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReviewList({ reviews }: { reviews: ReviewWithAuthor[] }) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        No written reviews yet — be the first to share your experience.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-2xl border border-border bg-card p-5 ring-hairline"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Monogram
                name={review.author?.name ?? "Anonymous"}
                accent={review.author?.accent ?? "#00ADB5"}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium">
                  {review.author?.name ?? "Anonymous"}
                </p>
                <p className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                  {review.author?.role ?? "Community"} ·{" "}
                  {formatDate(review.date)}
                </p>
              </div>
            </div>
            <StarRating value={review.rating} size={13} />
          </div>

          <h4 className="mt-4 font-display text-base font-semibold">
            {review.title}
          </h4>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            {review.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Delete the synthesized distribution component**

```bash
git rm src/components/detail/rating-distribution.tsx
```

- [ ] **Step 7: Remove the distribution from the tool detail page**

In `src/app/tools/[slug]/page.tsx`:

Remove the import line:

```tsx
import { RatingDistribution } from "@/components/detail/rating-distribution";
```

Remove `getRatingDistribution` from the `@/lib/content` import list (leave `getReviewsForTool` in place).

Remove the line that computes it:

```tsx
  const distribution = getRatingDistribution(tool.rating, tool.reviewCount);
```

Replace the reviews section body — delete the wrapper div containing `<RatingDistribution .../>` so the section goes straight from the header to the review lists:

```tsx
            {/* Reviews */}
            <section id="reviews">
              <div className="flex items-center justify-between">
                <SectionLabel icon="MessagesSquare" className="mb-0">
                  Reviews
                </SectionLabel>
                <ReviewModal toolName={tool.name} toolSlug={tool.slug} />
              </div>
              <div className="mt-6">
                <CommunityReviews toolSlug={tool.slug} />
                <ReviewList reviews={reviews} />
              </div>
            </section>
```

- [ ] **Step 8: Update the content tests**

In `src/lib/content.test.ts`, remove `getRatingDistribution` from the import list at the top, replace the `content: reviews` describe block, and delete the entire `content: rating distribution` describe block (lines 90-126):

```ts
describe("content: reviews", () => {
  it("returns authored reviews with resolved authors, newest first", () => {
    const reviews = getReviewsForTool("cursor");
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0].author?.name).toBeTruthy();
    for (let i = 1; i < reviews.length; i++) {
      expect(
        reviews[i - 1].date.localeCompare(reviews[i].date),
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 9: Verify the gates**

```bash
npm run typecheck && npm run lint && npx vitest run
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "fix(integrity): remove fabricated review trust signals

Drops the invented 'verified reviewer' badge, the invented helpful counts, and
the star histogram synthesized from an aggregate. None could be substantiated,
and presenting them as real user data is what 16 CFR Part 465 prohibits."
```

---

## Task 9: Stop claiming unverified ratings to search engines

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/lib/structured-data.ts`
- Modify: `src/lib/structured-data.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/structured-data.test.ts`, replace the two tests in the `structured-data: tool` describe block that assert on `aggregateRating` and `review`:

```ts
  it("omits AggregateRating while the seed ratings are unverified", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.aggregateRating).toBeUndefined();
  });

  it("omits embedded Review markup while the seed ratings are unverified", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.review).toBeUndefined();
  });

  it("still describes the application itself", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.name).toBe(tool.name);
    expect(String(app.url)).toContain("/tools/cursor");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/structured-data.test.ts
```

Expected: FAIL — `aggregateRating` is currently always emitted.

- [ ] **Step 3: Add the flag**

In `src/lib/site.ts`, add this entry to `siteConfig` immediately after `ogImage`:

```ts
  /**
   * Whether the aggregate `rating` / `reviewCount` carried on each tool reflect
   * real, verifiable user reviews.
   *
   * While the directory ships with editorial sample figures this stays FALSE and
   * no AggregateRating / Review markup is emitted. Structured data is a
   * machine-readable claim to search engines: marking up ratings that are not
   * genuine violates Google's review-snippet policy and, on a site that earns
   * affiliate revenue from those rankings, is an FTC exposure.
   *
   * Flip to true only once `rating` and `reviewCount` are computed from real
   * moderated reviews.
   */
  hasVerifiedRatings: false,
```

- [ ] **Step 4: Gate the markup**

In `src/lib/structured-data.ts`, add the import for the flag (it already imports `siteConfig`), then replace the `application` object construction inside `toolJsonLd`:

```ts
  const application: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: tool.name,
    description: tool.description,
    url,
    applicationCategory: categoryName ? `${categoryName} — AI tool` : "AI tool",
    operatingSystem: tool.platforms.join(", ") || "Web",
  };

  // Ratings are only ever claimed to search engines when they are real. See
  // siteConfig.hasVerifiedRatings.
  if (siteConfig.hasVerifiedRatings) {
    application.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: tool.rating,
      reviewCount: tool.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
    application.review = reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.author?.name ?? "Anonymous" },
      datePublished: r.date,
      name: r.title,
      reviewBody: r.body,
    }));
  }

  if (tool.logo) application.image = abs(tool.logo);
  if (offer) application.offers = offer;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/lib/structured-data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/lib/structured-data.ts src/lib/structured-data.test.ts
git commit -m "fix(seo): do not emit AggregateRating/Review markup for unverified ratings

Gated behind siteConfig.hasVerifiedRatings. Structured data is a machine-readable
claim; the seed rating figures cannot back one."
```

---

## Task 10: Strict seed validation in every environment

**Files:**
- Modify: `src/lib/content.ts`

- [ ] **Step 1: Make seed validation always throw**

In `src/lib/content.ts`, replace the `validate` function:

```ts
/**
 * Validate git-versioned seed content. Always throws on bad data, including in
 * production: `next build` runs with NODE_ENV=production, so a lenient path
 * here means the authoritative build is the one that skips the check. Bad seed
 * data should fail the build, not reach a page.
 *
 * Database-sourced tools do NOT come through here — they are safeParsed and
 * skipped individually in loadDbTools, so a bad row can never take the site down.
 */
function validate<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row, i) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new Error(
        `[Enki content] Invalid ${label} at index ${i}:\n${z.prettifyError(result.error)}`,
      );
    }
    return result.data;
  });
}
```

- [ ] **Step 2: Make the referential-integrity checks unconditional too**

In the same file, change the guard on the referential integrity block from:

```ts
if (process.env.NODE_ENV !== "production") {
```

to a plain block with an explanatory comment:

```ts
// Referential integrity: every seed tool points at a real category; every seed
// review at a real tool + author. Unconditional for the same reason as above —
// a dangling reference must fail the build.
{
```

- [ ] **Step 3: Add a documenting comment to the cache invalidator**

Replace the `invalidateToolCache` doc comment:

```ts
/**
 * Drop the tool cache (call after an admin write so edits appear immediately).
 *
 * Note: this clears the module-level cache in ONE serverless instance. Other
 * warm instances keep serving their cached copy for up to CACHE_TTL_MS, so a
 * fresh edit can take up to a minute to appear everywhere. Self-healing, and
 * acceptable at this scale — if it stops being so, key the cache on a version
 * row bumped by saveTool rather than on wall-clock time.
 */
```

- [ ] **Step 4: Verify the gates**

```bash
npm run typecheck && npm run lint && npx vitest run
```

Expected: all pass — the committed seed is valid, so the stricter check is a no-op today.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content.ts
git commit -m "fix(content): validate seed data in production builds too

next build runs with NODE_ENV=production, so the old guard skipped validation in
the one run that matters."
```

---

## Task 11: Next 16 proxy rename

**Files:**
- Rename: `src/middleware.ts` → `src/proxy.ts`

- [ ] **Step 1: Rename the file**

```bash
git mv src/middleware.ts src/proxy.ts
```

- [ ] **Step 2: Rename the exported function**

Replace the whole of `src/proxy.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on every route except static assets and image/model files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|ico)$).*)",
  ],
};
```

- [ ] **Step 3: Verify the build accepts it and the deprecation warning is gone**

```bash
npm run build
```

Expected: build succeeds, ~181 routes, and no `middleware.ts is deprecated` warning in the output.

If the build errors or warns that no proxy was found, revert with `git mv src/proxy.ts src/middleware.ts`, restore the `middleware` export name, and note in `handoff.md` that the rename is still pending. Do not leave the app without session refresh.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: rename middleware.ts to proxy.ts for Next 16"
```

---

## Task 12: Verification and documentation

**Files:**
- Modify: `handoff.md`

- [ ] **Step 1: Run the full gate suite**

```bash
npm run typecheck && npm run lint && npx vitest run && npm run build
```

Expected: typecheck clean, lint clean, all tests pass, build succeeds with ~181 routes.

- [ ] **Step 2: Run the mandatory visual sweep**

Per `CLAUDE.md`, the changes to `review-list.tsx`, `community-reviews.tsx`, `site-footer.tsx`, `submit-form.tsx`, the tool detail page, and the admin KPI grid are all visual code and must be verified in a real browser.

1. `preview_start` with `{ name: "enki-dev" }` (or build + `npx next start -p <port>` and `preview_start { url }` if the harness will not keep the dev server alive).
2. Load `/` and `/tools` (always-check pages), plus `/tools/cursor` (review list + removed distribution), `/submit` (honeypot), and any page with the footer.
3. `read_console_messages` with `onlyErrors` — must be zero.
4. Measure with `javascript_tool`, do not eyeball:
   - The honeypot must not affect layout: its `getBoundingClientRect().right` must be `< 0` (off-screen left) and `document.body.scrollWidth <= window.innerWidth` (no horizontal overflow introduced).
   - Review cards: the star rating's `right` must stay `<= ` the card's `right`.
   - The reviews section must have no `scrollWidth > clientWidth`.
   - The admin KPI grid change is behind auth and cannot be loaded; verify the 6-column class compiles and note that the logged-in view needs a human click-through.
5. Re-check at a narrow (375px) and wide (1280px) viewport with `resize_window`.
6. Capture a screenshot if the pane composites; otherwise report the measurements.

- [ ] **Step 3: Update the handoff**

In `handoff.md`, make these corrections:

Under **§1 → Everything that works → Reviews**, replace the bullet:

```markdown
- **Reviews** — auth-gated, Postgres-persisted, and **pre-moderated**: new and
  edited reviews land as `pending` and only an admin-guarded RPC
  (`admin_set_review_status`) can publish them. Authors see their own queued
  review labelled "Awaiting review"; everyone else sees approved only. The
  community rating averages approved reviews only.
```

Under **§4 → Schema**, replace the `reviews` row:

```markdown
| `reviews` | `(id, tool_slug, user_id, rating 1–5, title?, body?, **status**, created_at, updated_at)` | public-read **approved**; owner read/write own; **status is column-revoked** — only `admin_set_review_status()` sets it, and a BEFORE trigger forces edits back to `pending` |
```

Under **§4 → RPCs**, add:

```markdown
- **`admin_set_review_status(review_id uuid, new_status text)`** → boolean; the
  only path that may write `reviews.status`. Self-guards with `is_admin()` and
  returns false (not an error) for everyone else. `anon` cannot execute it.
```

Under **§4 → Migrations applied**, append `harden_review_moderation`, `harden_public_input`.

Under **§5 → Server mutations**, correct the claim:

```markdown
| Server mutations | **Next server actions** (submit, newsletter, admin moderation + tool CRUD). Reviews, saved tools, and collections write from the browser client under RLS — not through server actions. **Every admin action calls `assertAdmin()` itself**: server actions are public POST endpoints, and RLS alone does not stop an unauthorized caller from triggering their side effects. |
```

Replace the **§12 Open items** list with:

```markdown
## 12. Open items / next steps

### Operator decisions needed before a public launch
- **The seed `rating` / `reviewCount` on tools are editorial sample figures, not
  real community aggregates**, and the six reviewers in `src/data/authors.ts` are
  invented personas. The unsubstantiable parts built on top of them are gone
  (verified badges, helpful counts, the synthesized histogram, and all
  AggregateRating/Review structured data — see `siteConfig.hasVerifiedRatings`),
  but the displayed numbers and bylines remain. For a monetized review site,
  decide before launch whether to (a) replace them with real moderated-review
  aggregates, (b) relabel them plainly as editorial estimates, or (c) remove
  them. Flip `hasVerifiedRatings` to true only once (a) is done.
- **Edge rate limiting.** The public forms have honeypots and Postgres CHECK
  constraints, but no request-rate ceiling. Add Vercel WAF / firewall rules for
  `/submit`, `/go/*`, and the newsletter action at deploy time.
- **Enable leaked-password protection** in Supabase → Auth (flagged by the
  security advisors; dashboard-only setting).

### Still to build
- **Deploy** (§2b) — Vercel git import + env vars (your action), then verify;
  grant yourself admin (§2c).
- **Email sending** — the newsletter *captures* subscribers but doesn't send.
  Wire a provider (Resend/Postmark) + `RESEND_API_KEY` for the weekly digest +
  per-tool "notify me when this changes" alerts.
- **Link-health cron** — a Vercel Cron that pings each tool's site and flags dead
  links into the admin re-vet queue.
- **CMS authoring UX** — the tool editor is a Zod-validated JSON editor. A
  field-by-field form is the polish pass.
- **A nonce-based CSP** — deliberately omitted in `next.config.ts` because the 3D
  hero and Vercel Analytics need a validated policy first.
- **Component/E2E tests** — `lib` logic and the admin/CMS server actions are now
  covered; the React components remain largely untested.
- **Consider a real `createdAt`/`updatedAt` on tools** to power an honest RSS
  feed / "recently added" digest.
```

Add to **§10 Gotchas**:

```markdown
8. **`reviews.status` is not writable over PostgREST.** Table-level INSERT/UPDATE
   were revoked and re-granted per column. If you add a column to `reviews`,
   you must grant it explicitly or writes will start failing with a permission
   error. A table-level grant will silently re-open the moderation bypass —
   never `grant update on public.reviews`.
```

- [ ] **Step 4: Commit**

```bash
git add handoff.md
git commit -m "docs: correct the moderation model and record pre-launch decisions"
```

---

## Self-review checklist

Run before declaring the plan complete:

1. **Finding coverage:** #1 → Tasks 1, 4. #2 → Tasks 1, 4, 7. #3 → Tasks 3, 4, 5. #4 → Tasks 8, 9. #5 → Tasks 2, 6. #6 → Tasks 2, 6, 10, 11, 12.
2. **Type consistency:** `assertAdmin` returns `AdminCheck` with `reason` and `error` on the failure branch — used identically in Tasks 4 and 5. `ReviewStatus` includes `pending` in both `actions.ts` and `moderation-actions.tsx`. `queryStub`/`supabaseStub` signatures match every call site in the three test files.
3. **No placeholders:** every code step contains the literal code to write.
