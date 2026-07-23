# Tracked Affiliate Outbound + Disclosure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Route every "Visit tool" outbound link through an internal `/go/[slug]` redirect that logs the click to Supabase and forwards to the tool's affiliate URL (falling back to its website), with FTC-compliant disclosure — turning the outbound click into a measurable, monetizable event.

**Architecture:** A pure resolver (`src/lib/outbound.ts`, unit-tested) decides the destination + affiliate status from a tool. A route handler (`src/app/go/[slug]/route.ts`) resolves the tool from static content, inserts an anonymous click row into a new Supabase `outbound_clicks` table, and 302-redirects. The two existing outbound `<a href={tool.website}>` links (tool detail + compare) point at `/go/[slug]` with a conditional `sponsored` rel and a disclosure line. No PII is logged (tool slug + source path + timestamp only).

**Tech Stack:** Next.js 16 route handlers, Supabase (`@supabase/supabase-js` anon client for the server-side insert; RLS insert-only), Zod content schema, Vitest.

**Live DB:** project `qknsqurdawglctwqfwxe` (enki). Migrations applied via the Supabase MCP `apply_migration`.

---

## Design decisions (locked)

- **All** outbound tool links route through `/go/[slug]` so click data covers every tool, not only affiliates.
- **Destination** = `tool.affiliateUrl ?? tool.website`. `affiliateUrl` is a new optional schema field; no tool has one yet (redirects to website until affiliate deals are added via seed/CMS). The infra is affiliate-ready today.
- **rel**: `sponsored noopener noreferrer` when the tool has an `affiliateUrl`, else `noopener noreferrer` (never mislabel a non-paid link as sponsored).
- **Privacy**: `outbound_clicks` stores `tool_slug`, `path` (same-origin source page), `created_at`. No IP, no user id. RLS allows anonymous INSERT only; reads are blocked for anon (admin reads via service role later).
- **Redirect** awaits the insert (fast, single round-trip) for reliability on serverless, then 302s. Unknown slug → redirect to `/tools` (never dead-ends).
- **Disclosure**: a reusable `<AffiliateDisclosure />` line under the detail-page CTA + an "Affiliate links" section on `/privacy` (anchor `#affiliate`).

### File structure
- Create `src/lib/outbound.ts` — `outboundHref(slug)`, `resolveOutboundTarget(tool)`. One responsibility: outbound URL logic.
- Create `src/lib/outbound.test.ts` — unit tests.
- Create `src/lib/supabase/anon.ts` — a tiny anonymous server-side Supabase client for logging (no cookies/auth).
- Create `src/app/go/[slug]/route.ts` — the tracked redirect.
- Create `src/components/shared/affiliate-disclosure.tsx` — the disclosure line.
- Modify `src/lib/schemas.ts` — add optional `affiliateUrl` to `toolSchema`.
- Modify `src/lib/content.ts` — add `affiliateUrl` + `isAffiliate` to the `CompareTool` projection.
- Modify `src/app/tools/[slug]/page.tsx` — reroute CTA + rel + disclosure.
- Modify `src/components/compare/compare-view.tsx` — reroute "Visit site" + rel.
- Modify `src/app/privacy/page.tsx` — add the "Affiliate links" section.
- Supabase migration: `outbound_clicks` table + RLS (applied via MCP, not a repo file).

---

## Task 1: Schema field + outbound resolver (pure, TDD)

**Files:**
- Modify: `src/lib/schemas.ts`
- Create: `src/lib/outbound.ts`, `src/lib/outbound.test.ts`

- [ ] **Step 1: Add `affiliateUrl` to `toolSchema`** — in `src/lib/schemas.ts`, inside `toolSchema`, right after the `website: z.url(),` line add:

```ts
  /** Optional affiliate/referral URL; when set, outbound links use it and are marked rel="sponsored". */
  affiliateUrl: z.url().optional(),
```

- [ ] **Step 2: Write the failing tests** — create `src/lib/outbound.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";
import type { Tool } from "@/lib/schemas";

const base = { slug: "acme", website: "https://acme.com" } as unknown as Tool;

describe("outbound", () => {
  it("builds the internal redirect href from a slug", () => {
    expect(outboundHref("cursor")).toBe("/go/cursor");
  });

  it("falls back to the website when there is no affiliate URL", () => {
    expect(resolveOutboundTarget(base)).toEqual({
      url: "https://acme.com",
      isAffiliate: false,
    });
  });

  it("prefers the affiliate URL when present and marks it affiliate", () => {
    const tool = { ...base, affiliateUrl: "https://ref.acme.com?ref=enki" } as Tool;
    expect(resolveOutboundTarget(tool)).toEqual({
      url: "https://ref.acme.com?ref=enki",
      isAffiliate: true,
    });
  });
});
```

- [ ] **Step 3: Run to verify fail** — `npm run test -- src/lib/outbound.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement `src/lib/outbound.ts`**:

```ts
import type { Tool } from "@/lib/schemas";

/** Internal tracked-redirect path for a tool slug. */
export function outboundHref(slug: string): string {
  return `/go/${slug}`;
}

export type OutboundTarget = {
  /** Final external destination. */
  url: string;
  /** True when an affiliate URL was used (drives rel="sponsored"). */
  isAffiliate: boolean;
};

/** Resolve where a tool's outbound link should ultimately go. */
export function resolveOutboundTarget(
  tool: Pick<Tool, "website" | "affiliateUrl">,
): OutboundTarget {
  if (tool.affiliateUrl) {
    return { url: tool.affiliateUrl, isAffiliate: true };
  }
  return { url: tool.website, isAffiliate: false };
}
```

- [ ] **Step 5: Verify pass** — `npm run test -- src/lib/outbound.test.ts` → PASS (3). Then `npm run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/lib/outbound.ts src/lib/outbound.test.ts
git commit -m "feat(outbound): affiliateUrl schema field and outbound resolver"
```

---

## Task 2: Supabase `outbound_clicks` table (live migration)

**Applied via the Supabase MCP `apply_migration` tool (project `qknsqurdawglctwqfwxe`).** Confirm the project is active first (`list_tables`; if it times out, `restore_project` and wait).

- [ ] **Step 1: Apply the migration** — `apply_migration` with name `create_outbound_clicks` and query:

```sql
create table if not exists public.outbound_clicks (
  id bigint generated always as identity primary key,
  tool_slug text not null,
  path text,
  created_at timestamptz not null default now()
);

alter table public.outbound_clicks enable row level security;

-- Anonymous visitors may record a click, but cannot read the table.
drop policy if exists "anon insert outbound clicks" on public.outbound_clicks;
create policy "anon insert outbound clicks"
  on public.outbound_clicks
  for insert
  to anon
  with check (true);

create index if not exists outbound_clicks_tool_slug_idx
  on public.outbound_clicks (tool_slug);
create index if not exists outbound_clicks_created_at_idx
  on public.outbound_clicks (created_at desc);
```

- [ ] **Step 2: Verify the table exists** — `list_tables` (verbose) shows `outbound_clicks` with the 4 columns and RLS enabled. Record the result.

- [ ] **Step 3: Regenerate DB types** — update `src/lib/supabase/database.types.ts` to add the `outbound_clicks` table so the client is typed. Add this block inside `public.Tables` (alongside `profiles`, `reviews`, `saved_tools`):

```ts
      outbound_clicks: {
        Row: {
          created_at: string
          id: number
          path: string | null
          tool_slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          path?: string | null
          tool_slug: string
        }
        Update: {
          created_at?: string
          id?: never
          path?: string | null
          tool_slug?: string
        }
        Relationships: []
      }
```

- [ ] **Step 4: Commit** (migration is remote; commit the types)

```bash
git add src/lib/supabase/database.types.ts
git commit -m "feat(outbound): outbound_clicks table types"
```

---

## Task 3: Anonymous Supabase client + tracked redirect route

**Files:**
- Create: `src/lib/supabase/anon.ts`, `src/app/go/[slug]/route.ts`

- [ ] **Step 1: Create `src/lib/supabase/anon.ts`**:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A minimal, cookie-less Supabase client for anonymous server-side writes
 * (e.g. logging outbound clicks). Not for authenticated/user-scoped access —
 * use the SSR client in server.ts for that.
 */
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: Create `src/app/go/[slug]/route.ts`**:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getToolBySlug } from "@/lib/content";
import { resolveOutboundTarget } from "@/lib/outbound";
import { createAnonClient } from "@/lib/supabase/anon";
import { siteConfig } from "@/lib/site";

/**
 * Tracked outbound redirect. Records an anonymous click (tool + source path,
 * no PII) then 302s to the tool's affiliate URL or website. Unknown slugs fall
 * back to the directory so a link never dead-ends.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return NextResponse.redirect(new URL("/tools", siteConfig.url));
  }

  const { url } = resolveOutboundTarget(tool);

  // Same-origin source path only (never the full external referrer).
  let path: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.origin === new URL(request.url).origin) path = u.pathname;
    } catch {
      path = null;
    }
  }

  try {
    await createAnonClient()
      .from("outbound_clicks")
      .insert({ tool_slug: slug, path });
  } catch {
    // Never let logging failure block the user's navigation.
  }

  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: Verify types + build** — `npm run typecheck && npm run build` → PASS; route list shows `ƒ /go/[slug]`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/anon.ts src/app/go/[slug]/route.ts
git commit -m "feat(outbound): tracked /go/[slug] redirect with anonymous click logging"
```

---

## Task 4: Reroute outbound links + disclosure component

**Files:**
- Create: `src/components/shared/affiliate-disclosure.tsx`
- Modify: `src/lib/content.ts`, `src/app/tools/[slug]/page.tsx`, `src/components/compare/compare-view.tsx`

- [ ] **Step 1: Create `src/components/shared/affiliate-disclosure.tsx`**:

```tsx
import Link from "next/link";

/**
 * FTC-friendly affiliate disclosure. Shown near outbound links; the full policy
 * lives on the privacy page (#affiliate).
 */
export function AffiliateDisclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      <Link href="/privacy#affiliate" className="hover:text-foreground hover:underline">
        We may earn a commission
      </Link>{" "}
      if you sign up through our links — it never affects our rating.
    </p>
  );
}
```

- [ ] **Step 2: Add affiliate fields to `CompareTool`** — in `src/lib/content.ts`, add to the `CompareTool` type (after `website: string;`):

```ts
  isAffiliate: boolean;
```

and in `getCompareTools()`'s mapped object (after `website: t.website,`):

```ts
      isAffiliate: Boolean(t.affiliateUrl),
```

- [ ] **Step 3: Reroute the tool-detail CTA** — in `src/app/tools/[slug]/page.tsx`, add imports near the top:

```ts
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";
import { AffiliateDisclosure } from "@/components/shared/affiliate-disclosure";
```

Inside `ToolDetailPage`, after `const tool = getToolBySlug(slug); if (!tool) notFound();`, add:

```ts
  const outbound = resolveOutboundTarget(tool);
```

Replace the existing "Visit {tool.name}" anchor (the `<a href={tool.website} target="_blank" rel="noopener noreferrer" …>`) with:

```tsx
                <a
                  href={outboundHref(tool.slug)}
                  target="_blank"
                  rel={
                    outbound.isAffiliate
                      ? "sponsored noopener noreferrer"
                      : "noopener noreferrer"
                  }
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold whitespace-nowrap text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright hover:shadow-glow"
                >
                  Visit {tool.name}
                  <Icon
                    name="ArrowUpRight"
                    className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
```

Then, immediately after the actions row `</div>` that contains the buttons (the `flex flex-col gap-3 sm:flex-row …` block), add the disclosure:

```tsx
              <AffiliateDisclosure className="text-xs text-muted-foreground/70" />
```

- [ ] **Step 4: Reroute the compare "Visit site" link** — in `src/components/compare/compare-view.tsx`, add the import:

```ts
import { outboundHref } from "@/lib/outbound";
```

Replace the `<a href={t.website} …>Visit site</a>` block with:

```tsx
                <a
                  href={outboundHref(t.slug)}
                  target="_blank"
                  rel={
                    t.isAffiliate
                      ? "sponsored noopener noreferrer"
                      : "noopener noreferrer"
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                >
                  Visit site
                  <Icon name="ExternalLink" className="size-3.5" />
                </a>
```

- [ ] **Step 5: Verify** — `npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/affiliate-disclosure.tsx src/lib/content.ts "src/app/tools/[slug]/page.tsx" src/components/compare/compare-view.tsx
git commit -m "feat(outbound): route Visit links through tracker with disclosure + sponsored rel"
```

---

## Task 5: Privacy page "Affiliate links" section

**Files:**
- Modify: `src/app/privacy/page.tsx`

- [ ] **Step 1: Add the section** — in `src/app/privacy/page.tsx`, inside the `<section>` after the "Your choices" block, add:

```tsx
          <h2
            id="affiliate"
            className="mt-4 scroll-mt-28 font-display text-xl font-semibold text-foreground"
          >
            Affiliate links
          </h2>
          <p>
            Some outbound links to tools are affiliate links, meaning Enki may
            earn a commission if you sign up or purchase through them, at no
            extra cost to you. Affiliate relationships never influence our editor
            scores, verdicts, or rankings — those are decided independently
            before any commercial arrangement.
          </p>
```

- [ ] **Step 2: Verify** — `npm run build` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "docs(outbound): affiliate disclosure section on privacy page"
```

---

## Final Verification Phase

- [ ] **V1: Static gates** — `npm run typecheck && npm run lint && npm run test && npm run build` → all PASS; route list includes `ƒ /go/[slug]`; unit count up by 3.

- [ ] **V2: Redirect + logging (live)** — start prod server; then:
  - `curl -sI "http://localhost:<port>/go/cursor" -H "referer: http://localhost:<port>/tools/cursor"` → `HTTP 307/302` with `location:` = cursor's website.
  - `curl -sI "http://localhost:<port>/go/does-not-exist"` → redirect to `/tools`.
  - Via Supabase MCP `execute_sql`: `select tool_slug, path, created_at from outbound_clicks order by created_at desc limit 5;` → shows the `cursor` click with `path=/tools/cursor`. (Confirms the RLS insert works end-to-end.)

- [ ] **V3: Visual sweep** (CLAUDE.md → Visual Sweep):
  - `/tools/cursor` — the "Visit Cursor" button renders unchanged; the disclosure line sits beneath the actions; console clean; measure no layout shift/overflow in the actions row.
  - `/compare?tools=cursor,perplexity` (or via the compare tray) — "Visit site" renders; console clean.
  - `/privacy` — the "Affiliate links" section renders; the detail-page disclosure link jumps to `#affiliate`.

- [ ] **V4: Report** — gates + curl output + the DB row + measurements.

---

## Self-Review
- **Coverage:** affiliate field + resolver (T1) ✓; live table + RLS + types (T2) ✓; tracked redirect + anon logging (T3) ✓; reroute both outbound links + conditional sponsored rel + disclosure (T4) ✓; privacy policy section (T5) ✓; end-to-end DB verification (Final V2) ✓.
- **Placeholders:** none — full code/SQL in every step.
- **Type consistency:** `outboundHref`, `resolveOutboundTarget`, `OutboundTarget`, `createAnonClient`, `AffiliateDisclosure`, `CompareTool.isAffiliate` defined then used consistently. `affiliateUrl` optional on `toolSchema` and read in the resolver + compare projection + route.
- **Privacy:** no IP/user-id logged; only tool slug + same-origin path + timestamp; RLS blocks anon reads.
- **Ambiguity:** destination precedence (`affiliateUrl ?? website`), rel policy (sponsored only when affiliate), and unknown-slug fallback (`/tools`) are all explicit.
