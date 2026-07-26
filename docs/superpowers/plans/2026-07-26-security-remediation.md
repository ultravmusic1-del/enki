# Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding in `docs/superpowers/plans/2026-07-26-security-audit-remediation.md` that is fixable in code or SQL, and add regression tests so none of them can silently return.

**Architecture:** Ordered by risk reduction per unit of risk introduced. Dependency patches land first (largest win, zero code change, and it means every later verification runs against patched libraries). Then the live application defects, each fixed test-first. Then the database migrations, which change observable behaviour and so go last among the fixes. Finally the permanence layer: an RLS smoke test and a CI audit gate, so the guarantees are machine-checked rather than remembered.

The protocol allowlist is deliberately implemented at **three** layers — Zod, a Postgres CHECK, and a render-time helper — because each covers a caller the others miss: the CHECK binds clients that skip the app and call PostgREST with the public key, and the render helper covers rows written before the constraint existed.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zod v4, Supabase (Postgres + RLS), Vitest, Playwright, pnpm 11, GitHub Actions.

---

## Decisions taken (from the audit review)

- **F4, private notes → "never publish".** `/lists/[id]` stops selecting and rendering `note`. There are currently **0** rows with a note, so nothing already written is exposed.
- **F6, rate limiting → deferred to its own plan.** Closing the direct-PostgREST bypass means revoking anon INSERT grants and routing three working features through server-only endpoints. That is an architectural change, not a patch.

## Not in this plan — dashboard actions only you can take

| Finding | Action | Where |
|---|---|---|
| F10 | Enable leaked-password protection (HaveIBeenPwned) | Supabase → Authentication → Policies |
| F10 | Raise the minimum password length to 10+ | Supabase → Authentication → Policies |
| F12 | Site URL = `https://enki-five.vercel.app`; add `https://enki-five.vercel.app/auth/callback` to Redirect URLs | Supabase → Authentication → URL Configuration |

Task 11 raises the *client-side* minimum, but only the dashboard setting is enforceable — a client can always post directly to GoTrue.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/lib/safe-redirect.ts` | Sole authority on "is this redirect target on our origin" |
| `src/lib/safe-redirect.test.ts` | Its tests, including the bypass shapes |
| `src/lib/safe-url.ts` | Sole authority on the external-URL protocol allowlist |
| `src/lib/safe-url.test.ts` | Its tests, mirroring the audit's probe payloads |
| `scripts/audit-rls.mjs` | Live RLS smoke test against PostgREST with the public key |
| `scripts/audit-rls/expectations.mjs` | Pure: which tables must be anon-invisible, and verdict logic |
| `scripts/audit-rls/expectations.test.mjs` | Its tests |

**Modified:**

| Path | Change |
|---|---|
| `package.json` | Patch `next`; move `shadcn` to devDependencies; add `audit:rls` script |
| `.github/workflows/verify.yml` | Least-privilege token; `pnpm audit` gate |
| `src/components/auth/login-form.tsx` | Validate the redirect target; raise password minimum |
| `src/app/auth/callback/route.ts` | Defence-in-depth redirect validation |
| `src/lib/schemas.ts` | `website`, `affiliateUrl`, submission `url` use the http-only schema |
| `src/app/admin/page.tsx` | Render submission URLs through `safeExternalHref` |
| `src/app/go/[slug]/route.ts` | Refuse to emit a non-http `Location` |
| `src/app/lists/[id]/page.tsx` | Stop selecting and rendering `note` |
| `next.config.ts` | Report-only Content-Security-Policy |
| `handoff.md`, `CLAUDE.md` | Record the new invariants and commands |

**Migrations (via Supabase MCP `apply_migration`):**

| Name | Purpose |
|---|---|
| `tighten_submission_url_scheme` | `tool_submissions.url` must start `http://` or `https://` |
| `narrow_profiles_read` | Replace `USING (true)` with a purpose-scoped policy |
| `revoke_unnecessary_anon_grants` | Least privilege on `tools` and `profiles` |

---

## Task 1: Patch Next.js (F1)

Nine advisories, four HIGH, all fixed by a patch bump. Doing this first means every later verification runs against patched libraries.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Record the current advisory count**

Run: `pnpm audit 2>&1 | tail -3`

Expected: `16 vulnerabilities found` with `7 moderate | 9 high`. Write the number down so the improvement is measurable rather than assumed.

- [ ] **Step 2: Bump next and its eslint config together**

They are version-locked in this project; bumping one alone causes a lint config mismatch.

```bash
pnpm add next@16.2.12
pnpm add -D eslint-config-next@16.2.12
```

- [ ] **Step 3: Confirm every `next` advisory is gone**

Run:

```bash
pnpm audit --json 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const a=Object.values(JSON.parse(s).advisories||{});
  const n=a.filter(v=>v.module_name==='next');
  console.log('next advisories:', n.length);
  n.forEach(v=>console.log('  ['+v.severity+'] '+v.title));
  console.log('total advisories:', a.length);
});"
```

Expected: `next advisories: 0`, and a total meaningfully below the 16 recorded in Step 1. If any `next` advisory remains, read its title — a new one may have landed against 16.2.12, in which case stop and report rather than pressing on.

- [ ] **Step 4: Run the full gate**

Run: `pnpm verify`

Expected: typecheck clean, lint clean, 185 tests passing.

- [ ] **Step 5: Confirm the production build still works**

Run: `pnpm build`

Expected: `✓ Compiled successfully`, 182 static pages. A minor-version React/Next mismatch shows up here, not in the unit tests.

- [ ] **Step 6: Prove the running app is unbroken**

```bash
pnpm dev
```

In a second shell:

```bash
pnpm sweep -- / /tools /tools/cursor /finder
```

Expected: `Sweep clean.` — 8 route/viewport combinations PASS, zero console errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "fix(deps): patch Next.js to 16.2.12, closing 9 advisories"
```

---

## Task 2: Move `shadcn` out of production dependencies (F8)

`shadcn` is a scaffolding CLI that no runtime code imports. As a production dependency it drags `fast-uri` (HIGH), `brace-expansion` (HIGH), `@hono/node-server`, `ts-morph`, `@modelcontextprotocol/sdk`, and `@dotenvx/dotenvx` into the shipped tree.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Prove nothing imports it at runtime**

Run: `grep -rn "from \"shadcn\"\|require(\"shadcn\")\|from 'shadcn'" src scripts || echo "NO RUNTIME IMPORTS"`

Expected: `NO RUNTIME IMPORTS`. Do not proceed if this finds anything.

- [ ] **Step 2: Move it**

```bash
pnpm remove shadcn
pnpm add -D shadcn
```

- [ ] **Step 3: Confirm the production tree is cleaner**

Run: `pnpm audit --prod 2>&1 | grep -E "fast-uri|hono|brace-expansion" || echo "GONE FROM PROD TREE"`

Expected: `GONE FROM PROD TREE`.

- [ ] **Step 4: Confirm the CLI still works for future component adds**

Run: `pnpm shadcn --version`

Expected: a version number. It is a devDependency now, which is exactly where a scaffolding CLI belongs.

- [ ] **Step 5: Run the gate and build**

Run: `pnpm verify && pnpm build`

Expected: 185 tests passing, build clean. `components.json` is untouched, so nothing about component generation changes.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: move shadcn to devDependencies, shrinking the production tree"
```

---

## Task 3: Least-privilege CI token (F11)

**Files:**
- Modify: `.github/workflows/verify.yml`

- [ ] **Step 1: Add an explicit permissions block**

Insert immediately after the `on:` block and before `concurrency:`:

```yaml
# The job only reads the repo. Fork PRs already get a read-only token, but
# stating it means a future workflow edit cannot silently inherit write scope.
permissions:
  contents: read
```

- [ ] **Step 2: Verify the file still parses as valid YAML**

Run: `node -e "const f=require('fs').readFileSync('.github/workflows/verify.yml','utf8'); if(!/^permissions:/m.test(f)) throw new Error('permissions block missing'); if(!/contents: read/.test(f)) throw new Error('scope missing'); console.log('workflow ok')"`

Expected: `workflow ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify.yml
git commit -m "ci: scope the workflow token to read-only"
```

---

## Task 4: Redirect validator (F2)

`login-form.tsx` currently feeds an unvalidated query parameter to `router.push()`, so a link on the real domain can bounce a user to an attacker's site the moment they authenticate.

**Files:**
- Create: `src/lib/safe-redirect.ts`
- Test: `src/lib/safe-redirect.test.ts`
- Modify: `src/components/auth/login-form.tsx`, `src/app/auth/callback/route.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/safe-redirect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("keeps an ordinary internal path", () => {
    expect(safeInternalPath("/admin")).toBe("/admin");
  });

  it("keeps a path with a query string and fragment", () => {
    expect(safeInternalPath("/tools?sort=rating#top")).toBe(
      "/tools?sort=rating#top",
    );
  });

  it("falls back when the parameter is absent", () => {
    expect(safeInternalPath(null)).toBe("/");
  });

  it("falls back on an empty string", () => {
    expect(safeInternalPath("")).toBe("/");
  });

  it("rejects an absolute http URL", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    // "//evil.example" inherits the current scheme and leaves the origin.
    expect(safeInternalPath("//evil.example")).toBe("/");
  });

  it("rejects the backslash variant of a protocol-relative URL", () => {
    // Several browsers normalize "\" to "/", making "/\evil" behave as "//evil".
    expect(safeInternalPath("/\\evil.example")).toBe("/");
  });

  it("rejects a javascript: target", () => {
    expect(safeInternalPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects a scheme-relative URL with mixed slashes", () => {
    expect(safeInternalPath("/\\/evil.example")).toBe("/");
  });

  it("honours an explicit fallback", () => {
    expect(safeInternalPath("https://evil.example", "/login")).toBe("/login");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/safe-redirect.test.ts`

Expected: FAIL — `Failed to resolve import "@/lib/safe-redirect"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/safe-redirect.ts`:

```ts
/**
 * The single authority on where a post-authentication redirect may point.
 *
 * A `?redirect=` parameter is attacker-controlled. Handing one straight to
 * `router.push()` turns the real login page into a phishing launcher: the
 * victim sees the genuine domain, authenticates, and only then lands on the
 * attacker's site -- the moment they are most convinced the site is real.
 *
 * Only same-origin paths survive. Anything else collapses to the fallback.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;

  // Must be a rooted path. Rejects "https://evil", "javascript:...", "evil.com".
  if (!raw.startsWith("/")) return fallback;

  // "//host" is protocol-relative and leaves the origin. "/\host" is the same
  // thing to browsers that normalize backslashes, so both are refused.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  return raw;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/safe-redirect.test.ts`

Expected: PASS, 10 tests.

- [ ] **Step 5: Wire it into the login form**

In `src/components/auth/login-form.tsx`, add the import after the existing `createClient` import:

```ts
import { safeInternalPath } from "@/lib/safe-redirect";
```

Then replace line 16:

```ts
  const redirectTo = searchParams.get("redirect") || "/";
```

with:

```ts
  // Never trust ?redirect= — see src/lib/safe-redirect.ts.
  const redirectTo = safeInternalPath(searchParams.get("redirect"));
```

Both `router.push(redirectTo)` call sites and the `emailRedirectTo` interpolation now receive a validated value with no further change.

- [ ] **Step 6: Add defence in depth on the server callback**

`src/app/auth/callback/route.ts` builds `${origin}${redirect}`, so an absolute URL cannot currently escape. Validate anyway, so the guarantee does not depend on that one string concatenation surviving future edits.

Replace line 8:

```ts
  const redirect = searchParams.get("redirect") || "/";
```

with:

```ts
  const redirect = safeInternalPath(searchParams.get("redirect"));
```

and add the import at the top:

```ts
import { safeInternalPath } from "@/lib/safe-redirect";
```

- [ ] **Step 7: Verify the whole suite and the app**

Run: `pnpm verify`

Expected: 195 tests passing (185 + 10 new).

- [ ] **Step 8: Prove the fix in a real browser**

With `pnpm dev` running:

```bash
pnpm sweep -- /login
```

Expected: `Sweep clean.` Then confirm the parameter is neutralised — open
`http://localhost:3000/login?redirect=https://example.com` and run in the console:

```js
new URL(location.href).searchParams.get("redirect")
```

The parameter is still present in the URL (expected — we validate at use, not at parse); what matters is that a successful sign-in now navigates to `/`. Verify by reading the built value:

```js
document.querySelector("form") !== null
```

Expected: `true` — the page renders normally with the hostile parameter present, which is the regression this step guards.

- [ ] **Step 9: Commit**

```bash
git add src/lib/safe-redirect.ts src/lib/safe-redirect.test.ts src/components/auth/login-form.tsx src/app/auth/callback/route.ts
git commit -m "fix(auth): validate redirect targets, closing an open redirect on /login"
```

---

## Task 5: URL protocol allowlist — application layer (F5)

Zod v4's `z.url()` only checks that `new URL()` parses, so it accepts `javascript:`, `data:`, `vbscript:`, and `file:`. This task adds the allowlist and routes both the CMS schema and the public submission schema through it.

**Files:**
- Create: `src/lib/safe-url.ts`
- Test: `src/lib/safe-url.test.ts`
- Modify: `src/lib/schemas.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/safe-url.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isHttpUrl, safeExternalHref } from "@/lib/safe-url";

describe("isHttpUrl", () => {
  it("accepts https", () => {
    expect(isHttpUrl("https://cursor.com")).toBe(true);
  });

  it("accepts http", () => {
    expect(isHttpUrl("http://example.com/path?q=1")).toBe(true);
  });

  // Each of these is ACCEPTED by z.url(), which is exactly why this exists.
  it("rejects javascript:", () => {
    expect(isHttpUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects javascript: regardless of case", () => {
    expect(isHttpUrl("JaVaScRiPt:alert(1)")).toBe(false);
  });

  it("rejects data:", () => {
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects vbscript:", () => {
    expect(isHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects file:", () => {
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a string that is not a URL at all", () => {
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isHttpUrl("")).toBe(false);
  });

  it("rejects leading whitespace used to smuggle a scheme", () => {
    expect(isHttpUrl("  javascript:alert(1)")).toBe(false);
  });
});

describe("safeExternalHref", () => {
  it("passes an http(s) URL through unchanged", () => {
    expect(safeExternalHref("https://cursor.com")).toBe("https://cursor.com");
  });

  it("neutralizes a javascript: URL to an inert href", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBe("#");
  });

  it("neutralizes null", () => {
    expect(safeExternalHref(null)).toBe("#");
  });

  it("honours a custom fallback", () => {
    expect(safeExternalHref("javascript:alert(1)", "/tools")).toBe("/tools");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/safe-url.test.ts`

Expected: FAIL — `Failed to resolve import "@/lib/safe-url"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/safe-url.ts`:

```ts
/**
 * The single authority on which URL schemes this app will store or emit.
 *
 * Zod v4's `z.url()` only asks whether `new URL()` parses, so it happily
 * accepts `javascript:`, `data:`, `vbscript:`, and `file:`. Those values reach
 * a stored field (`tools.website`, `tools.affiliateUrl`, and the public
 * `tool_submissions.url`) and from there an `href` or a `Location` header.
 *
 * A `javascript:` href executes in this origin when clicked. Today the one
 * admin sink carries `target="_blank"`, which current Chrome refuses to run
 * `javascript:` for -- but that is an incidental presentation attribute, not a
 * security control. This module is the control.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** True only for a well-formed absolute http(s) URL. */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  // Reject leading/trailing whitespace outright rather than trimming it: a
  // value that needs trimming to look safe is not a value we want to store.
  if (value !== value.trim()) return false;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * An href that is safe to render. Anything not http(s) becomes inert, which
 * covers rows written before the schema and database constraints existed.
 */
export function safeExternalHref(
  value: string | null | undefined,
  fallback = "#",
): string {
  return isHttpUrl(value) ? (value as string) : fallback;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/safe-url.test.ts`

Expected: PASS, 14 tests.

- [ ] **Step 5: Route the schemas through it**

In `src/lib/schemas.ts`, add the import below the existing `zod` import:

```ts
import { isHttpUrl } from "@/lib/safe-url";
```

Then add this shared schema immediately after the `iconName` definition (around line 23):

```ts
/**
 * An absolute http(s) URL. Plain `z.url()` is not enough: it accepts
 * `javascript:`, `data:`, and `file:` because it only checks that the URL
 * parses. See src/lib/safe-url.ts.
 */
const httpUrl = z
  .string()
  .refine(isHttpUrl, "Must be an http:// or https:// URL");
```

Replace `website: z.url(),` (line 91) with:

```ts
  website: httpUrl,
```

Replace `affiliateUrl: z.url().optional(),` (line 93) with:

```ts
  affiliateUrl: httpUrl.optional(),
```

Replace `url: z.url("Enter a valid URL, including https://").max(2048),` (line 184) with:

```ts
  url: z
    .string()
    .max(2048)
    .refine(isHttpUrl, "Enter a valid http:// or https:// URL"),
```

(Written out rather than composed from `httpUrl` with `.and()`: an intersection of two string schemas produces confusing error messages, and this field needs its own length bound and its own user-facing message.)

- [ ] **Step 6: Add schema-level tests**

First add these two imports at the **top** of `src/lib/safe-url.test.ts`, beneath the existing imports:

```ts
import { toolSchema, submissionFormSchema } from "@/lib/schemas";
import { tools as seedTools } from "@/data/tools";
```

Then append this block to the end of the file:

```ts
describe("schemas reject dangerous URL schemes", () => {
  it("submissionFormSchema rejects a javascript: url", () => {
    const result = submissionFormSchema.safeParse({
      name: "Evil",
      url: "javascript:alert(document.cookie)",
    });
    expect(result.success).toBe(false);
  });

  it("submissionFormSchema still accepts a normal url", () => {
    const result = submissionFormSchema.safeParse({
      name: "Cursor",
      url: "https://cursor.com",
    });
    expect(result.success).toBe(true);
  });

  it("toolSchema rejects a javascript: website", () => {
    const result = toolSchema.safeParse({
      ...seedTools[0],
      website: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("toolSchema rejects a javascript: affiliateUrl", () => {
    const result = toolSchema.safeParse({
      ...seedTools[0],
      affiliateUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("every seeded tool still validates", () => {
    // The allowlist must not have invalidated real content.
    for (const tool of seedTools) {
      expect(toolSchema.safeParse(tool).success).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run src/lib/safe-url.test.ts`

Expected: PASS, 19 tests. The final case is the important one — if a real seeded tool now fails, the allowlist is too strict and must be fixed before going further.

- [ ] **Step 8: Run the full gate**

Run: `pnpm verify`

Expected: 214 tests passing (195 + 19). `src/lib/content.test.ts` exercises the seed through `toolSchema`, so a regression there surfaces here.

- [ ] **Step 9: Commit**

```bash
git add src/lib/safe-url.ts src/lib/safe-url.test.ts src/lib/schemas.ts
git commit -m "fix(validation): restrict stored URLs to http(s), closing the javascript: hole"
```

---

## Task 6: URL protocol allowlist — render and redirect layers (F5)

The schema stops new bad values. This stops any that already exist, and stops the redirect route emitting a hostile `Location`.

**Files:**
- Modify: `src/app/admin/page.tsx:187`, `src/app/go/[slug]/route.ts`

- [ ] **Step 1: Neutralize the admin submission link**

In `src/app/admin/page.tsx`, add the import alongside the other `@/lib` imports:

```ts
import { safeExternalHref } from "@/lib/safe-url";
```

Replace line 187:

```tsx
                      href={s.url}
```

with:

```tsx
                      // Submitted by anyone; never trust the scheme. A non-http
                      // value renders inert rather than executable.
                      href={safeExternalHref(s.url)}
```

- [ ] **Step 2: Refuse to redirect to a non-http destination**

In `src/app/go/[slug]/route.ts`, add the import:

```ts
import { isHttpUrl } from "@/lib/safe-url";
```

Replace line 23:

```ts
  const { url } = resolveOutboundTarget(tool);
```

with:

```ts
  const { url } = resolveOutboundTarget(tool);

  // A stored non-http target (mobile deep link, javascript:, data:) must never
  // become a Location header. Fall back to the directory rather than 502-ing.
  if (!isHttpUrl(url)) {
    console.error("[enki] refusing non-http outbound target", { slug });
    return NextResponse.redirect(new URL("/tools", siteConfig.url));
  }
```

- [ ] **Step 3: Write a regression test for the outbound guard**

Create `src/lib/outbound-guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isHttpUrl } from "@/lib/safe-url";
import { resolveOutboundTarget } from "@/lib/outbound";

/**
 * The /go/[slug] route must never emit a non-http Location. This pins the
 * decision function the route relies on, for the tool shapes it actually sees.
 */
describe("outbound target guard", () => {
  it("passes a normal website through", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: undefined,
    });
    expect(isHttpUrl(target.url)).toBe(true);
  });

  it("prefers the affiliate URL when present", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: "https://ref.example/cursor",
    });
    expect(target.url).toBe("https://ref.example/cursor");
    expect(target.isAffiliate).toBe(true);
  });

  it("flags a javascript: affiliate URL as unsafe to emit", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: "javascript:alert(1)",
    });
    expect(isHttpUrl(target.url)).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/lib/outbound-guard.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Verify the redirect still works end to end**

With `pnpm dev` running:

```bash
curl -s -o /dev/null -w "go/cursor -> %{http_code} %{redirect_url}\n" http://localhost:3000/go/cursor
```

Expected: `307` or `302` to the real Cursor URL. A `/tools` fallback here would mean the guard is rejecting legitimate content — investigate before continuing.

- [ ] **Step 6: Sweep the admin-adjacent and detail pages**

```bash
pnpm sweep -- / /tools /tools/cursor /deals
```

Expected: `Sweep clean.`

- [ ] **Step 7: Run the full gate**

Run: `pnpm verify`

Expected: 217 tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/page.tsx src/app/go/[slug]/route.ts src/lib/outbound-guard.test.ts
git commit -m "fix(xss): neutralize non-http URLs at the render and redirect layers"
```

---

## Task 7: Database constraint on submission URLs (F5, third layer)

The publishable key is public, so anyone can POST straight to PostgREST and never execute the Zod check. The database has to enforce the same rule. There are currently **0** rows in `tool_submissions`, so this cannot fail on existing data.

**Files:**
- Migration (via Supabase MCP `apply_migration`, name `tighten_submission_url_scheme`)

- [ ] **Step 1: Confirm no existing row would violate the constraint**

Run via the Supabase MCP `execute_sql`:

```sql
select count(*) as would_violate
from public.tool_submissions
where url !~* '^https?://';
```

Expected: `0`. If not zero, clean or delete those rows first — adding the constraint would otherwise fail.

- [ ] **Step 2: Apply the migration**

Via Supabase MCP `apply_migration`, name `tighten_submission_url_scheme`:

```sql
-- The app validates submission URLs with Zod, but the anon key is public and a
-- direct PostgREST caller never runs that code. The old constraint checked
-- length only, so `javascript:...` was storable. Bind the scheme here too.
alter table public.tool_submissions
  drop constraint if exists tool_submissions_url_check;

alter table public.tool_submissions
  add constraint tool_submissions_url_check
  check (char_length(url) between 1 and 2048 and url ~* '^https?://');
```

- [ ] **Step 3: Prove the constraint rejects a hostile scheme**

Run via `execute_sql`:

```sql
do $$
begin
  insert into public.tool_submissions (name, url)
  values ('constraint probe', 'javascript:alert(1)');
  raise exception 'FAIL: the constraint did not reject javascript:';
exception
  when check_violation then
    raise notice 'PASS: check constraint rejected javascript:';
end $$;
```

Expected: no error, and the notice `PASS: check constraint rejected javascript:`. The `do` block rolls back, so nothing is written.

- [ ] **Step 4: Prove a legitimate URL is still accepted**

Run via `execute_sql`:

```sql
do $$
begin
  insert into public.tool_submissions (name, url)
  values ('constraint probe', 'https://example.com/tool');
  raise notice 'PASS: legitimate https URL accepted';
  raise exception 'rollback probe';
exception
  when others then
    if sqlerrm <> 'rollback probe' then raise; end if;
end $$;
```

Expected: the notice `PASS: legitimate https URL accepted`, and nothing persisted.

- [ ] **Step 5: Confirm the table is still empty**

Run via `execute_sql`: `select count(*) from public.tool_submissions;`

Expected: `0` — both probes rolled back.

- [ ] **Step 6: Commit the migration record**

Migrations are applied through the MCP connector and are not files in this repo, so record it in the handoff instead. In `handoff.md` §4, add `tighten_submission_url_scheme` to the "Migrations applied (via MCP)" list.

```bash
git add handoff.md
git commit -m "db: require an http(s) scheme on submitted tool URLs"
```

---

## Task 8: Stop publishing collection notes (F4)

The UI calls these "private notes" in two places. Publishing them on a shareable, indexable page contradicts that promise. There are **0** notes today, so nothing already written is exposed.

**Files:**
- Modify: `src/app/lists/[id]/page.tsx`

- [ ] **Step 1: Stop selecting the column**

In `src/app/lists/[id]/page.tsx`, replace the `collection_items` query (line 26):

```ts
      .select("tool_slug, note, created_at")
```

with:

```ts
      // `note` is deliberately not selected: the collections UI calls these
      // "private notes", so a public list must not publish them.
      .select("tool_slug, created_at")
```

- [ ] **Step 2: Drop it from the returned shape**

Replace the `entries` mapping (around line 69):

```ts
  const entries = list.items
    .map((it) => ({ tool: toolBySlug.get(it.tool_slug), note: it.note }))
    .filter((e): e is { tool: NonNullable<typeof e.tool>; note: string | null } =>
      Boolean(e.tool),
    );
```

with:

```ts
  const entries = list.items
    .map((it) => ({ tool: toolBySlug.get(it.tool_slug) }))
    .filter((e): e is { tool: NonNullable<typeof e.tool> } => Boolean(e.tool));
```

- [ ] **Step 3: Remove the render block**

Replace the entries render (around line 96):

```tsx
            {entries.map(({ tool, note }) => (
              <div key={tool.slug} className="flex flex-col gap-2">
                <ToolCard
                  tool={tool}
                  categoryName={categoryName.get(tool.categorySlug)}
                />
                {note && (
                  <p className="flex items-start gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-pretty text-muted-foreground">
                    <Icon name="Quote" className="mt-0.5 size-3.5 shrink-0 text-teal" />
                    {note}
                  </p>
                )}
              </div>
            ))}
```

with:

```tsx
            {entries.map(({ tool }) => (
              <ToolCard
                key={tool.slug}
                tool={tool}
                categoryName={categoryName.get(tool.categorySlug)}
              />
            ))}
```

- [ ] **Step 4: Remove the now-unused Icon import if nothing else uses it**

Run: `grep -n "Icon" "src/app/lists/[id]/page.tsx"`

If `Icon` appears only on the import line, delete that import. If it is used elsewhere on the page, leave it. Lint will fail the build on an unused import, so this is not optional.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`

Expected: both clean. The typecheck is what proves the `note` property is genuinely gone from the shape rather than merely unrendered.

- [ ] **Step 6: Confirm the note never leaves the database**

Run: `grep -n "note" "src/app/lists/[id]/page.tsx" || echo "NO NOTE REFERENCES ON THE PUBLIC LIST PAGE"`

Expected: `NO NOTE REFERENCES ON THE PUBLIC LIST PAGE`. Not selecting the column is the real fix; not rendering it would still ship the text in the server payload.

- [ ] **Step 7: Run the gate and sweep**

Run: `pnpm verify`

Expected: 217 tests passing.

With `pnpm dev` running: `pnpm sweep -- /collections`

Expected: `Sweep clean.` (`/lists/[id]` needs a real public collection id, so it is not sweepable without seeded data; `/collections` covers the manager UI that shares the components.)

- [ ] **Step 8: Commit**

```bash
git add "src/app/lists/[id]/page.tsx"
git commit -m "fix(privacy): stop publishing collection notes on shared lists"
```

---

## Task 9: Narrow the `profiles` read policy (F3)

`SELECT USING (true)` exposes every user id, display name, and signup time to anonymous callers — including the admin's UUID. Narrow it to the three cases the app actually needs.

**Files:**
- Migration (via Supabase MCP `apply_migration`, name `narrow_profiles_read`)

- [ ] **Step 1: Record the current exposure**

```bash
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=id,display_name"
```

(Read the two values from `.env.local`.) Expected: two rows, including `7fc156ef-…`. This is the "before" state.

- [ ] **Step 2: Apply the migration**

Via Supabase MCP `apply_migration`, name `narrow_profiles_read`:

```sql
-- `USING (true)` let any anonymous caller enumerate every user and, worse,
-- learn the admin's user id. A display name only needs to be public where the
-- app actually shows one: next to an approved review, or as the curator of a
-- public collection. Everything else is private.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

create policy "Profiles readable where a name is shown"
  on public.profiles for select
  using (
    -- your own profile
    id = (select auth.uid())
    -- the author of a publicly visible review
    or exists (
      select 1 from public.reviews r
      where r.user_id = profiles.id and r.status = 'approved'
    )
    -- the curator of a public collection
    or exists (
      select 1 from public.collections c
      where c.user_id = profiles.id and c.is_public
    )
  );

-- Support the two lookups above.
create index if not exists reviews_user_status_idx
  on public.reviews (user_id, status);
create index if not exists collections_user_public_idx
  on public.collections (user_id, is_public);
```

- [ ] **Step 3: Verify anonymous enumeration is closed**

```bash
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=id,display_name"
```

Expected: `[]`. There are currently no approved reviews and no public collections, so no profile should be visible to an anonymous caller.

- [ ] **Step 4: Verify the policy still exposes a name when it should**

Run via `execute_sql` — this proves the review branch works before any real review exists:

```sql
do $$
declare visible int;
begin
  -- Simulate: does the policy's review branch match for a given profile?
  select count(*) into visible
  from public.profiles p
  where exists (
    select 1 from public.reviews r
    where r.user_id = p.id and r.status = 'approved'
  );
  raise notice 'profiles visible via approved reviews: %', visible;
end $$;
```

Expected: the notice reporting `0`, matching the zero approved reviews. The branch is syntactically exercised; the live check happens in Step 5.

- [ ] **Step 5: Verify the app still renders author names**

With `pnpm dev` running, open a tool page and confirm the community reviews section loads. `community-reviews.tsx` already falls back to `"Anonymous"` when a profile row is not returned, so a mistake here degrades gracefully rather than erroring — which is why Step 3's `[]` is the load-bearing check.

```bash
pnpm sweep -- /tools/cursor
```

Expected: `Sweep clean.` — in particular zero console errors, which is what a broken PostgREST query would produce.

- [ ] **Step 6: Re-run the security advisors**

Via Supabase MCP `get_advisors` with `type: "security"`.

Expected: no new findings. The `rls_enabled_no_policy` note on `admins` and the intentional `WITH CHECK (true)` insert policies remain — those are by design.

- [ ] **Step 7: Record it**

Add `narrow_profiles_read` to the migrations list in `handoff.md` §4.

```bash
git add handoff.md
git commit -m "db: narrow profiles reads to where a display name is actually shown"
```

---

## Task 10: Revoke unnecessary anon grants (F9)

`anon` holds INSERT/UPDATE on every column of `tools` and `profiles`. RLS blocks those writes today, so this is latent rather than exploitable — but the grant should not be sitting there waiting for a future permissive policy.

**Files:**
- Migration (via Supabase MCP `apply_migration`, name `revoke_unnecessary_anon_grants`)

- [ ] **Step 1: Apply the migration**

Via Supabase MCP `apply_migration`, name `revoke_unnecessary_anon_grants`:

```sql
-- Least privilege. RLS already denies these writes, but a grant that exists for
-- no reason is one permissive policy away from being exploitable. Reads are
-- untouched: the public site reads `tools` anonymously.
revoke insert, update, delete on public.tools from anon;
revoke insert, update, delete on public.profiles from anon;
```

- [ ] **Step 2: Verify anon reads still work**

```bash
curl -s -o /dev/null -w "tools read as anon -> %{http_code}\n" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tools?select=slug&limit=1"
```

Expected: `200`. The public site depends on this; a 401/403 here means the revoke was too broad.

- [ ] **Step 3: Verify the grants are gone**

Run via `execute_sql`:

```sql
select table_name, privilege_type, count(*) as cols
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('tools','profiles')
  and grantee = 'anon'
group by table_name, privilege_type
order by table_name, privilege_type;
```

Expected: only `SELECT` (and `REFERENCES`) rows remain. No `INSERT`, `UPDATE`, or `DELETE`.

- [ ] **Step 4: Verify the admin CMS still writes**

This is the change most likely to break something. Sign in as the admin, open `/admin/tools`, edit a tool, and save. Expected: the save succeeds — the CMS writes as `authenticated`, whose grants were not touched.

If you cannot sign in during this session, at minimum confirm the `authenticated` grants survived:

```sql
select privilege_type, string_agg(column_name, ', ' order by column_name) as cols
from information_schema.column_privileges
where table_schema='public' and table_name='tools' and grantee='authenticated'
group by privilege_type order by privilege_type;
```

Expected: `INSERT`, `SELECT`, `UPDATE` still present across all columns.

- [ ] **Step 5: Record it**

Add `revoke_unnecessary_anon_grants` to the migrations list in `handoff.md` §4.

```bash
git add handoff.md
git commit -m "db: revoke unused anon write grants on tools and profiles"
```

---

## Task 11: Raise the client password minimum (F10, code half)

**Files:**
- Modify: `src/components/auth/login-form.tsx`

- [ ] **Step 1: Raise the minimum and the hint**

In `src/components/auth/login-form.tsx`, replace line 149:

```tsx
            minLength={6}
```

with:

```tsx
            minLength={10}
```

and replace the placeholder on line 152:

```tsx
            placeholder="At least 6 characters"
```

with:

```tsx
            placeholder="At least 10 characters"
```

- [ ] **Step 2: Verify the form still renders and validates**

With `pnpm dev` running: `pnpm sweep -- /login`

Expected: `Sweep clean.`

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/login-form.tsx
git commit -m "fix(auth): raise the client-side password minimum to 10 characters"
```

**Note for the operator:** this is cosmetic on its own — a client can post straight to GoTrue. The enforceable control is the Supabase dashboard setting listed at the top of this plan, and it must be raised there too.

---

## Task 12: Report-only Content-Security-Policy (F7)

**Be clear about what this does and does not achieve.** The candidate policy below keeps `script-src 'unsafe-inline'`, because Next's hydration scripts are inline and removing it requires nonce propagation. `'unsafe-inline'` still permits `javascript:` URLs, so **this does not mitigate F5** — Tasks 5, 6, and 7 do. What it does buy is real: `object-src 'none'`, `base-uri 'self'` (blocks base-tag injection), `form-action 'self'` (blocks form-hijack exfiltration), and `frame-ancestors 'self'`. Report-only cannot break rendering, so this is a safe first step that also measures how far the app is from a nonce-only policy.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add the report-only header**

In `next.config.ts`, replace the `securityHeaders` array with:

```ts
/**
 * Report-only to start. Enforcing requires removing `'unsafe-inline'` from
 * script-src, which needs nonce propagation through proxy.ts for Next's inline
 * hydration scripts. Until then this policy is measurement plus the directives
 * that cost nothing: object-src, base-uri, form-action, frame-ancestors.
 *
 * Note: with `'unsafe-inline'` present this does NOT block `javascript:` URLs.
 * That hole is closed in src/lib/safe-url.ts and the tool_submissions CHECK.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];
```

- [ ] **Step 2: Build and serve production, since headers differ from dev**

```bash
pnpm build
npx next start -p 3100
```

- [ ] **Step 3: Confirm the header is present**

```bash
curl -sI http://localhost:3100/ | tr -d '\r' | grep -i "content-security-policy-report-only"
```

Expected: the policy string.

- [ ] **Step 4: Collect violations with the sweep**

```bash
pnpm sweep -- --base http://localhost:3100 / /tools /tools/cursor /finder /login
```

The sweep reports console errors, and CSP report-only violations appear there. Expected: `Sweep clean.` — report-only violations are warnings in Chrome, not errors, so a clean sweep confirms nothing *broke*. Read the browser console directly for the violation list and record it in the commit message; that list is the input to a future enforcing policy.

- [ ] **Step 5: Stop the production server**

```bash
pid=$(netstat -ano | grep ":3100" | grep LISTENING | awk '{print $5}' | head -1)
if [ -n "$pid" ]; then taskkill //F //PID "$pid"; fi
curl -s -o /dev/null -w "3100: %{http_code}\n" --max-time 3 http://localhost:3100/ || echo "3100: stopped"
```

Expected: `SUCCESS: The process ... has been terminated.` then `3100: stopped`.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add a report-only CSP to measure toward enforcement"
```

---

## Task 13: RLS smoke test (permanence)

The audit's most valuable check was a handful of `curl` calls proving anon cannot read privileged tables. Policy regressions are invisible until someone looks, so make it a command.

**Files:**
- Create: `scripts/audit-rls/expectations.mjs`
- Test: `scripts/audit-rls/expectations.test.mjs`
- Create: `scripts/audit-rls.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `scripts/audit-rls/expectations.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { ANON_INVISIBLE_TABLES, judge } from "./expectations.mjs";

describe("ANON_INVISIBLE_TABLES", () => {
  it("covers every table holding private or operational data", () => {
    expect(ANON_INVISIBLE_TABLES).toEqual([
      "admins",
      "collections",
      "outbound_clicks",
      "profiles",
      "reviews",
      "subscribers",
      "tool_submissions",
    ]);
  });
});

describe("judge", () => {
  it("passes when an anon read returns no rows", () => {
    expect(judge("subscribers", { status: 200, rows: [] }).ok).toBe(true);
  });

  it("passes when the request is refused outright", () => {
    expect(judge("admins", { status: 401, rows: null }).ok).toBe(true);
  });

  it("fails when rows leak", () => {
    const verdict = judge("profiles", { status: 200, rows: [{ id: "x" }] });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("1 row");
  });

  it("reports the row count so the leak size is obvious", () => {
    const verdict = judge("reviews", {
      status: 200,
      rows: [{ id: "a" }, { id: "b" }],
    });
    expect(verdict.detail).toContain("2 row");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/audit-rls/expectations.test.mjs`

Expected: FAIL — `Failed to resolve import "./expectations.mjs"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/audit-rls/expectations.mjs`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/audit-rls/expectations.test.mjs`

Expected: PASS, 5 tests.

- [ ] **Step 5: Write the CLI**

Create `scripts/audit-rls.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm audit:rls` — prove Row Level Security still holds against the public key.
 *
 * Reads .env.local directly rather than relying on a loader, so it behaves the
 * same whether run by hand, from CI, or from a hook.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { ANON_INVISIBLE_TABLES, judge } from "./audit-rls/expectations.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ]),
  );
}

const env = { ...readEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "audit:rls needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (run `pnpm doctor`).",
  );
  process.exit(1);
}

const verdicts = [];
for (const table of ANON_INVISIBLE_TABLES) {
  let response = { status: 0, rows: null };
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
      headers: { apikey: key },
    });
    const rows = res.ok ? await res.json() : null;
    response = { status: res.status, rows: Array.isArray(rows) ? rows : null };
  } catch (error) {
    console.error(`  could not reach ${table}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judge(table, response));
}

console.log("\nRLS smoke test (anonymous, publishable key)\n");
for (const v of verdicts) {
  console.log(`  ${v.ok ? "PASS" : "FAIL"}  ${v.table.padEnd(18)} ${v.detail}`);
}

const failed = verdicts.filter((v) => !v.ok);
console.log(
  failed.length === 0
    ? "\nRLS holds.\n"
    : `\n${failed.length} table(s) are readable by anonymous callers.\n`,
);

process.exit(failed.length === 0 ? 0 : 1);
```

- [ ] **Step 6: Register the script**

In `package.json`, add to `scripts` after `"doctor"`:

```json
    "audit:rls": "node scripts/audit-rls.mjs",
```

- [ ] **Step 7: Run it against the live database**

Run: `pnpm audit:rls`

Expected: seven `PASS` lines and `RLS holds.` with exit 0. `profiles` passing here is the direct confirmation that Task 9 worked.

- [ ] **Step 8: Prove the check can actually fail**

Temporarily add a table anon *can* read to the list — append `"tools"` to `ANON_INVISIBLE_TABLES` in `scripts/audit-rls/expectations.mjs` — then run `pnpm audit:rls`.

Expected: `FAIL  tools  LEAKED n row(s) to anon` and exit 1. **Then remove `"tools"` again** and re-run to confirm `RLS holds.` A check that has never failed is not a check.

Note: with zero rows in `tools` this may report `no rows` and pass. If so, use `profiles` with a temporarily widened policy, or accept that Step 7's seven passes plus the unit tests in Step 4 are the evidence — and say so rather than claiming a proof you did not get.

- [ ] **Step 9: Run the full gate**

Run: `pnpm verify`

Expected: 222 tests passing (217 + 5).

- [ ] **Step 10: Commit**

```bash
git add scripts/audit-rls.mjs scripts/audit-rls/ package.json
git commit -m "test(security): add an RLS smoke test against the public key"
```

---

## Task 14: Gate CI on dependency advisories (permanence)

F1 existed because nothing was watching. Make the machine watch.

**Files:**
- Modify: `.github/workflows/verify.yml`

- [ ] **Step 1: Add the audit step**

Append to the `steps:` list in `.github/workflows/verify.yml`, after the `pnpm verify` step:

```yaml
      # Fails the build on a high-severity advisory in the production tree.
      # Scoped to --prod: a dev-only advisory should not block a deploy, and
      # the full report stays available via `pnpm audit` locally.
      - name: Audit production dependencies
        run: pnpm audit --prod --audit-level high
```

- [ ] **Step 2: Verify it passes locally first**

Run: `pnpm audit --prod --audit-level high; echo "exit: $?"`

Expected: `exit: 0`. If it is non-zero, Tasks 1 and 2 did not clear everything in the production tree — read the output and resolve it before pushing, or CI will be red on arrival.

- [ ] **Step 3: Confirm the workflow still parses**

Run: `node -e "const f=require('fs').readFileSync('.github/workflows/verify.yml','utf8'); if(!/audit --prod/.test(f)) throw new Error('audit step missing'); console.log('workflow ok')"`

Expected: `workflow ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/verify.yml
git commit -m "ci: fail the build on high-severity production advisories"
```

---

## Task 15: Record the new invariants (docs)

Security properties that are not written down get refactored away.

**Files:**
- Modify: `handoff.md`, `CLAUDE.md`

- [ ] **Step 1: Add the security invariants to the handoff conventions**

In `handoff.md` §8 ("Conventions"), append:

```
- **URL schemes are allowlisted.** `src/lib/safe-url.ts` is the only authority.
  Never use bare `z.url()` for a stored URL — Zod v4 accepts `javascript:`,
  `data:`, and `file:`. New stored-URL fields use the `httpUrl` schema, and any
  new render site uses `safeExternalHref()`.
- **Redirect targets are validated.** `src/lib/safe-redirect.ts` is the only
  authority. Never hand a `?redirect=` parameter to `router.push()` directly.
- **Collection notes are private.** `/lists/[id]` must not select or render
  `collection_items.note`. The UI promises privacy in the collections manager.
- **`pnpm audit:rls` must stay green.** It proves anonymous callers cannot read
  `admins`, `profiles`, `reviews`, `collections`, `subscribers`,
  `tool_submissions`, or `outbound_clicks`.
```

- [ ] **Step 2: Add the new gotchas**

In `handoff.md` §10, append:

```
11. **`z.url()` is not a protocol check.** Zod v4 only asks whether `new URL()`
    parses, so `javascript:`, `data:`, `vbscript:`, and `file:` all validate.
    Use the `httpUrl` schema from `src/lib/schemas.ts`, which delegates to
    `isHttpUrl()` in `src/lib/safe-url.ts`.
12. **`target="_blank"` is not a security control.** Chrome refuses
    `javascript:` for `_blank` navigations, which is why the admin submission
    link was never exploitable — but that is browser behaviour, not a decision
    this codebase made. The real controls are the schema, the
    `tool_submissions_url_check` constraint, and `safeExternalHref()`.
```

- [ ] **Step 3: Add the command to CLAUDE.md**

In the `## Commands` table in `CLAUDE.md`, add a row after `pnpm verify`:

```
| `pnpm audit:rls` | Prove RLS still blocks anonymous reads of private tables |
```

- [ ] **Step 4: Commit**

```bash
git add handoff.md CLAUDE.md
git commit -m "docs: record the security invariants and the audit:rls command"
```

---

## Task 16: Full verification

- [ ] **Step 1: Run the complete gate**

Run: `pnpm verify`

Expected: typecheck clean, lint clean, **222 tests across 27 files** (185 at the start of this plan, plus 10 safe-redirect, 19 safe-url, 3 outbound-guard, 5 rls-expectations). Record the actual numbers; investigate any difference before proceeding.

- [ ] **Step 2: Confirm the dependency tree is clean**

Run: `pnpm audit --prod --audit-level high; echo "exit: $?"`

Expected: `exit: 0`.

- [ ] **Step 3: Confirm RLS holds**

Run: `pnpm audit:rls`

Expected: seven PASS lines, `RLS holds.`, exit 0.

- [ ] **Step 4: Confirm the machine is healthy**

Run: `pnpm doctor`

Expected: five PASS lines, exit 0.

- [ ] **Step 5: Build and sweep production**

```bash
pnpm build
npx next start -p 3100
```

In a second shell:

```bash
pnpm sweep -- --base http://localhost:3100 / /tools /tools/cursor /deals /finder /login /collections
```

Expected: `Sweep clean.` — 14 route/viewport combinations.

- [ ] **Step 6: Re-run the Supabase security advisors**

Via Supabase MCP `get_advisors`, `type: "security"`.

Expected: the intentional findings only (the `admins` no-policy note, the `WITH CHECK (true)` insert policies, `is_admin()` being PUBLIC-executable). Leaked-password protection will still appear until you change it in the dashboard.

- [ ] **Step 7: Re-verify the two fixed live defects by hand**

```bash
# F3: profiles no longer enumerable
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=id" 
```

Expected: `[]`.

```bash
# F5 third layer: the DB refuses a javascript: submission
curl -s -X POST -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"probe","url":"javascript:alert(1)"}' \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tool_submissions"
```

Expected: a `400` with a check-constraint violation. This is the one deliberate write attempt in the plan, and it is designed to be rejected — confirm afterwards that `tool_submissions` is still empty.

- [ ] **Step 8: Push and confirm CI**

```bash
git push origin main
```

Then poll the run for `conclusion: success`.

- [ ] **Step 9: Report honestly**

State the actual test count, audit exit codes, RLS results, sweep result, and CI conclusion. List the three dashboard actions still outstanding (leaked-password protection, password minimum, auth redirect URLs) as **not done**, because they are not yours to do. Do not claim a step passed whose output you did not read.

---

## Notes for the implementer

- **Order matters here more than usual.** Dependencies first so every later verification runs on patched libraries; application code before migrations so a failure is a local revert rather than a database rollback; migrations before the smoke test so the smoke test asserts the new reality.
- **Tasks 7, 9, and 10 change the live production database.** All three target tables are currently empty (verified: 0 submissions, 0 reviews, 0 collections, 0 notes, 0 tool rows, 2 profiles), so there is no data-migration risk — but there is no staging environment either. Read each verification step's expected output before moving on.
- **Task 10 is the most likely to break something.** Revoking grants is easy to over-apply. Step 2 and Step 4 exist specifically to catch that; do not skip them.
- **Task 12 does not fix F5.** Say so if asked. `'unsafe-inline'` still permits `javascript:` URLs; the allowlist in Tasks 5–7 is what closes it.
- **Nothing here addresses F6 (rate limiting).** It was deliberately deferred to its own plan, because closing the direct-PostgREST bypass means revoking anon INSERT grants and routing the submit, newsletter, and click-logging features through server-only endpoints.
