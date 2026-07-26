---
name: enki-supabase-change
description: Use before writing any Supabase query, migration, RLS policy, or grant in Enki - encodes traps that have already cost this project real time
---

## Enki Supabase Change

Every rule here comes from a bug that already shipped. `handoff.md` §4 and §10
have the long version.

### Before writing a query

- **Anonymous writes use `.insert()`, never `.upsert()`.** `.insert()` defaults
  to `return=minimal`, needs no SELECT, and works under an anon-insert-only
  policy. `.upsert()` returns a representation, needs SELECT, and fails
  *silently* where anon has no read policy. Treat a unique violation
  (`error.code === "23505"`) as a friendly no-op.
  `src/lib/supabase/anon-writes.test.ts` enforces this — if you add a new
  anonymous write path, add it to that test's list.
- **Query builders are lazy thenables.** `void supabase.from(...).insert(...)`
  never runs. Always `await` it or call `.then()`.
- **Content getters in `src/lib/content.ts` are async.** Await them.

### Before writing a migration

- **Never `grant update on public.reviews`.** Table-level INSERT/UPDATE were
  revoked and re-granted per column specifically so `reviews.status` stays
  unwritable over PostgREST. A table-level grant silently reopens the review
  self-approval bypass. Adding a column to `reviews` means granting that column
  explicitly.
- **`revoke execute ... from anon` on a function is a no-op.** Postgres grants
  EXECUTE to PUBLIC, and `anon` inherits it. Revoke from `public`, then
  re-grant to the roles you intend. Verify with `select proacl from pg_proc`;
  a leading `=X/postgres` entry is the PUBLIC grant.
- **`is_admin()` must stay PUBLIC-executable.** It runs inside RLS policies
  that anonymous readers hit (`published OR is_admin()` on `tools`), and policy
  expressions evaluate with the caller's privileges. Revoking it breaks the
  public site.

### Before writing a server action

- **Every admin server action calls `assertAdmin()` itself.** Server actions
  are public POST endpoints. RLS does not stop an unauthorized caller from
  triggering their side effects.

### Checking your work

- The project is on the free tier and auto-pauses. `pnpm doctor` reports
  whether it is awake.
- Use the Supabase MCP connector for migrations and SQL.
- Seeded auth users need token columns set to `''` rather than NULL, or GoTrue
  returns a 500. Supabase also rejects email domains with no MX record, so
  `*.test` addresses fail; use a real domain.
