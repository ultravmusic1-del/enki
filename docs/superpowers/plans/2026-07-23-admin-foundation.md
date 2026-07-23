# Admin Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A secure, role-gated `/admin` area giving the operator the two things they can't get today: **which tools actually drive outbound clicks** (monetization insight from feature #2) and **moderation control over community reviews** (feature #6's moderation half).

**Architecture:** Admin identity lives in a dedicated `admins` table that is **unwritable through the API** (RLS with no insert/update policies); a `SECURITY DEFINER` `is_admin()` function lets RLS policies and RPCs check membership without exposing the table. All admin data access goes through the user's own session (SSR client) so **RLS enforces authorization at the database layer** — no service-role secret in the app. The app-level guard is defense-in-depth, not the only lock.

**Tech Stack:** Next.js 16 server components + server actions, Supabase SSR client + RLS + SECURITY DEFINER RPC, Tailwind.

**Scope note (decomposition):** the full CMS is several sub-projects. This slice is the **foundation** — gate, dashboard, click analytics, review moderation. It deliberately does **not** migrate the 27 static seed tools into Supabase (that's the risky part that touches every page); tool CRUD is a later slice.

---

## Security design (deliberate)

- **Why not `profiles.role`:** the existing policy `Users can update their own profile` (`auth.uid() = id`, no column guard) would let any authenticated user set their own `role = 'admin'`. Privilege escalation. Admin membership therefore lives in a separate table users cannot write.
- **`admins` table:** RLS enabled, **zero policies** → unreachable via anon/authenticated API. Populated only via SQL/dashboard.
- **`is_admin()`:** `SECURITY DEFINER`, `stable`, `set search_path = public` — bypasses RLS on `admins` to answer a boolean, leaking nothing else.
- **Reviews visibility:** public sees `status = 'approved'`; admins see everything. Default `'approved'` preserves today's behavior (no silent hiding of existing reviews).
- **Click stats:** exposed via a `SECURITY DEFINER` RPC that self-guards with `is_admin()`, so non-admins get an empty set even if they call it directly.

---

## Task 1: Database migration

Applied via Supabase MCP `apply_migration` (project `qknsqurdawglctwqfwxe`).

- [ ] **Step 1: Apply** — name `admin_foundation`, query:

```sql
-- 1. Admin membership (NOT on profiles: users can update their own profile row).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Intentionally NO policies: unreachable via the API. Granted only via SQL.

-- 2. Membership check that RLS/RPCs can call without exposing the table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3. Moderation status on reviews. Default 'approved' keeps current behaviour.
alter table public.reviews
  add column if not exists status text not null default 'approved';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_status_check'
  ) then
    alter table public.reviews
      add constraint reviews_status_check
      check (status in ('approved','flagged','rejected'));
  end if;
end $$;
create index if not exists reviews_status_idx on public.reviews (status);

-- 4. Public sees approved reviews; admins see all.
drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Approved reviews are viewable by everyone"
  on public.reviews for select
  using (status = 'approved' or public.is_admin());

-- 5. Admins may moderate any review (users keep their own-row update policy).
drop policy if exists "Admins can update any review" on public.reviews;
create policy "Admins can update any review"
  on public.reviews for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Admins may read outbound clicks (anon keeps insert-only).
drop policy if exists "Admins can read outbound clicks" on public.outbound_clicks;
create policy "Admins can read outbound clicks"
  on public.outbound_clicks for select
  to authenticated
  using (public.is_admin());

-- 7. Aggregated click stats, self-guarded so non-admins get nothing.
create or replace function public.admin_click_stats(days int default 30)
returns table (tool_slug text, clicks bigint)
language sql
security definer
set search_path = public
stable
as $$
  select oc.tool_slug, count(*)::bigint as clicks
  from public.outbound_clicks oc
  where public.is_admin()
    and oc.created_at >= now() - make_interval(days => days)
  group by oc.tool_slug
  order by clicks desc;
$$;
```

- [ ] **Step 2: Verify** — `list_tables` shows `admins` (RLS on) and `reviews.status`; `execute_sql` on `pg_policies` shows the three new/updated policies.

---

## Task 2: DB types

**Files:** Modify `src/lib/supabase/database.types.ts`.

- [ ] **Step 1** — add `status: string` to the `reviews` Row/Insert/Update (Insert/Update optional), and add the `admins` table block inside `public.Tables`:

```ts
      admins: {
        Row: { created_at: string; user_id: string }
        Insert: { created_at?: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
        Relationships: []
      }
```

Also replace the empty `Functions` type with the two RPCs:

```ts
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      admin_click_stats: {
        Args: { days?: number }
        Returns: { tool_slug: string; clicks: number }[]
      }
    }
```

- [ ] **Step 2** — `npm run typecheck` → PASS.

---

## Task 3: Admin guard

**Files:** Create `src/lib/admin.ts`.

- [ ] **Step 1** — create `src/lib/admin.ts`:

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Defence in depth: RLS is the real authority (all
 * admin data is protected by policies), this just keeps non-admins out of the
 * UI and gives them a sensible destination.
 *
 * Returns the admin's user id; never returns for non-admins.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  return user.id;
}
```

- [ ] **Step 2** — `npm run typecheck` → PASS. (Confirm `createClient` in `src/lib/supabase/server.ts` is async; if it is sync, drop the `await`.)

---

## Task 4: Moderation server actions

**Files:** Create `src/app/admin/actions.ts`.

- [ ] **Step 1** — create `src/app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = ["approved", "flagged", "rejected"] as const;
export type ReviewStatus = (typeof ALLOWED)[number];

/**
 * Set a review's moderation status. Authorization is enforced by RLS (only
 * admins may update rows they don't own); the status whitelist guards against
 * a bad value reaching the CHECK constraint.
 */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  if (!ALLOWED.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 2** — `npm run typecheck` → PASS.

---

## Task 5: Admin dashboard

**Files:** Create `src/app/admin/page.tsx`, `src/app/admin/moderation-actions.tsx`.

- [ ] **Step 1** — create the client component for the moderation buttons, `src/app/admin/moderation-actions.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setReviewStatus, type ReviewStatus } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "flagged", label: "Flag" },
  { value: "rejected", label: "Reject" },
];

export function ModerationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending || status === opt.value}
          onClick={() =>
            startTransition(async () => {
              const res = await setReviewStatus(id, opt.value);
              if (res.ok) toast.success(`Review ${opt.value}`);
              else toast.error(res.error ?? "Could not update review");
            })
          }
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-wide uppercase transition-colors disabled:opacity-40",
            status === opt.value
              ? "border-teal/40 bg-teal/10 text-teal"
              : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2** — create `src/app/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/content";
import { Container } from "@/components/shared/container";
import { ModerationActions } from "@/app/admin/moderation-actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createClient();
  const nameBySlug = new Map(getAllTools().map((t) => [t.slug, t.name]));

  const [{ data: stats }, { count: reviewCount }, { data: reviews }] =
    await Promise.all([
      supabase.rpc("admin_click_stats", { days: 30 }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase
        .from("reviews")
        .select("id, tool_slug, rating, title, body, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const clickRows = stats ?? [];
  const totalClicks = clickRows.reduce((sum, r) => sum + Number(r.clicks), 0);

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Operator
          </p>
          <h1 className="font-display text-4xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Outbound demand and community moderation. Editorial content is still
            managed in <code className="font-mono">src/data</code>.
          </p>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border ring-hairline md:grid-cols-3">
          <Kpi label="Tools" value={String(nameBySlug.size)} />
          <Kpi label="Reviews" value={String(reviewCount ?? 0)} />
          <Kpi label="Outbound clicks (30d)" value={String(totalClicks)} />
        </section>

        {/* Click leaderboard */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Outbound demand · last 30 days
          </h2>
          {clickRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outbound clicks recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
              {clickRows.map((row, i) => (
                <div
                  key={row.tool_slug}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm">
                      {nameBySlug.get(row.tool_slug) ?? row.tool_slug}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-teal tabular-nums">
                    {row.clicks}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Moderation */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Community reviews
          </h2>
          {!reviews || reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No community reviews yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 ring-hairline"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {nameBySlug.get(r.tool_slug) ?? r.tool_slug}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {r.rating}★
                      </span>
                    </span>
                    <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                      {r.status}
                    </span>
                  </div>
                  {r.title && (
                    <p className="font-display text-base font-semibold">
                      {r.title}
                    </p>
                  )}
                  {r.body && (
                    <p className="text-sm text-pretty text-muted-foreground">
                      {r.body}
                    </p>
                  )}
                  <ModerationActions id={r.id} status={r.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-card px-4 py-6 text-center">
      <span className="font-display text-3xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 3** — `npm run typecheck && npm run lint && npm run build` → PASS; route list shows `/admin`.

---

## Task 6: Keep `/admin` out of search

**Files:** Modify `src/app/robots.ts`.

- [ ] **Step 1** — extend the `disallow` list:

```ts
      disallow: ["/saved", "/admin"],
```

- [ ] **Step 2** — `npm run build` → PASS.

---

## Final Verification Phase

- [ ] **V1: Static gates** — `typecheck && lint && test && build` all PASS.

- [ ] **V2: RLS enforcement (the real authority), via `execute_sql`:**
  - `select public.is_admin();` as the SQL role → confirm the function exists and returns a boolean (no auth context = false).
  - Confirm `admins` has **zero** policies: `select count(*) from pg_policies where tablename='admins';` → 0.
  - Confirm the reviews SELECT policy now filters by status and the two new policies exist.
  - Confirm `admin_click_stats` returns 0 rows without an admin context (self-guard works).

- [ ] **V3: Gate behaviour (no login needed)** — serve prod; `curl -sI http://localhost:<port>/admin` → redirect to `/login?redirect=/admin` (unauthenticated users never reach the dashboard).

- [ ] **V4: Visual sweep** — confirm no regression on public pages (`/`, `/tools`, a tool page): console clean, no layout change. The admin UI itself is handed to the operator (see handoff).

- [ ] **V5: Operator handoff** — provide the exact SQL to grant admin:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR_EMAIL_HERE'
on conflict (user_id) do nothing;
```

---

## Self-Review
- **Coverage:** admin identity + escalation-safe design (T1) ✓; types (T2) ✓; gate (T3) ✓; moderation actions (T4) ✓; dashboard with click analytics + moderation (T5) ✓; noindex (T6) ✓; RLS + gate verification (Final) ✓.
- **Placeholders:** none.
- **Type consistency:** `requireAdmin()`, `setReviewStatus(id, status)`, `ReviewStatus`, `is_admin`, `admin_click_stats(days)` defined then used consistently.
- **Security:** no service-role key in the app; RLS is the authority; `admins` unwritable via API; RPC self-guards; `/admin` noindexed.
- **Out of scope (next slice):** tool CRUD / static→Supabase content migration; re-vet queue (#5).
