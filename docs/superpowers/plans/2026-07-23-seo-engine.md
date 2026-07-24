# Programmatic SEO Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Generate hundreds of indexable, internally-linked, statically-rendered landing pages from the existing tool data — "Best {category} AI tools", "Alternatives to {tool}", and "{A} vs {B}" — plus `llms.txt`, structured data, sitemap coverage, and internal links, so search traffic funnels into the tool pages the affiliate/sponsored plumbing already monetizes.

**Architecture:** Three new SSG route families read the static content layer and render with the existing design components. A small pure `seo` helper builds canonical versus-slugs and pairs (unit-tested); reusable JSON-LD builders (`itemListJsonLd`, `faqJsonLd`, `breadcrumbJsonLd`) live alongside the existing structured-data module. Existing tool/category pages gain internal links into the new surfaces. Everything is additive and static — no auth, no DB.

**Tech Stack:** Next.js 16 App Router (SSG via `generateStaticParams`), schema.org JSON-LD, existing content + component layers. No new deps.

**Verifiability:** Fully autonomous — static pages, structured data, build-route inspection, browser sweep.

---

## Design decisions (locked)

- **Routes:** `/best/[category]` (8), `/alternatives/[slug]` (27), `/vs/[versus]` (same-category pairs, ~30–40). Plus `/llms.txt` and `/feed.xml` deferred? → **`/llms.txt` yes; RSS deferred** (no real per-tool timestamps to make a feed honest).
- **Versus canonicalization:** `versusSlug(a, b)` sorts slugs alphabetically joined by `-vs-`. `generateStaticParams` emits only canonical same-category pairs; the page sets `alternates.canonical` to the canonical URL so a reversed URL consolidates. Split on the literal `-vs-` (no tool slug contains that substring — verified in Task 2).
- **"Best" ranking:** by `editorScore` desc (our editorial judgment is the honest "best" signal), tie-break rating, reviewCount, name.
- **Structured data:** `ItemList` on best + alternatives; `FAQPage` on best + vs; `BreadcrumbList` on all three. Builders are generic and reused.
- **Internal linking:** tool page → "Alternatives to {tool}" + top same-category "vs"; category page → "Best {category}"; footer → a Compare/Best hub is out of scope (nav already dense) — sitemap + on-page links carry it.
- **Copy:** deterministic, templated, honest (no fabricated review quotes). Year label uses a constant, not `Date` (SSG-stable).

### File structure
- Create `src/lib/seo.ts` + `src/lib/seo.test.ts` — versus slug/pairs + alternatives helper.
- Modify `src/lib/structured-data.ts` — add `itemListJsonLd`, `faqJsonLd`, `breadcrumbJsonLd`; + `src/lib/structured-data.test.ts` (new).
- Create `src/app/best/[category]/page.tsx`.
- Create `src/app/alternatives/[slug]/page.tsx`.
- Create `src/app/vs/[versus]/page.tsx`.
- Create `src/app/llms.txt/route.ts`.
- Create `src/components/seo/ranked-tool-row.tsx` — a numbered listicle row (reuses ToolLogo/StarRating/PricingBadge).
- Modify `src/app/sitemap.ts` — add the three families.
- Modify `src/app/tools/[slug]/page.tsx` — internal links to alternatives + vs.
- Modify `src/app/categories/[slug]/page.tsx` — link to "Best {category}".

---

## Task 1: Reusable JSON-LD builders (TDD)

**Files:** Modify `src/lib/structured-data.ts`; Create `src/lib/structured-data.test.ts`.

- [ ] **Step 1: Write failing tests** — create `src/lib/structured-data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from "@/lib/structured-data";

describe("structured-data builders", () => {
  it("builds an ItemList with absolute URLs and 1-based positions", () => {
    const ld = itemListJsonLd([
      { name: "A", url: "/tools/a" },
      { name: "B", url: "/tools/b" },
    ]);
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0]).toMatchObject({ position: 1, name: "A" });
    expect(ld.itemListElement[0].url).toMatch(/^https?:\/\/.+\/tools\/a$/);
  });

  it("builds a FAQPage from Q/A pairs", () => {
    const ld = faqJsonLd([{ question: "Q?", answer: "A." }]);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q?",
    });
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });

  it("builds a BreadcrumbList with absolute item URLs", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Best", path: "/best/writing" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, name: "Best" });
    expect(ld.itemListElement[1].item).toMatch(/\/best\/writing$/);
  });
});
```

- [ ] **Step 2: Run → fail** — `npm run test -- src/lib/structured-data.test.ts`.

- [ ] **Step 3: Implement** — append to `src/lib/structured-data.ts` (the file already defines `const abs = (path) => new URL(path, BASE).toString()`):

```ts
/* ------------------------------------------------- reusable page builders */

/** ItemList — for ranked "best" and "alternatives" landing pages. */
export function itemListJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: abs(it.url),
    })),
  };
}

/** FAQPage — for the Q&A blocks on best/vs pages. */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** BreadcrumbList — shared across the new landing pages. */
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}
```

- [ ] **Step 4: Run → pass**; `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(seo): reusable ItemList/FAQ/Breadcrumb JSON-LD builders"`.

---

## Task 2: SEO helpers — versus slugs + pairs + alternatives (TDD)

**Files:** Create `src/lib/seo.ts`, `src/lib/seo.test.ts`.

- [ ] **Step 1: Write failing tests** — `src/lib/seo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAllTools } from "@/lib/content";
import {
  parseVersusSlug,
  versusPairs,
  versusSlug,
} from "@/lib/seo";

const tools = getAllTools();

describe("seo: versus slugs", () => {
  it("builds a canonical (alphabetical) versus slug", () => {
    expect(versusSlug("cursor", "windsurf")).toBe("cursor-vs-windsurf");
    expect(versusSlug("windsurf", "cursor")).toBe("cursor-vs-windsurf");
  });

  it("round-trips through parseVersusSlug", () => {
    expect(parseVersusSlug("cursor-vs-windsurf")).toEqual(["cursor", "windsurf"]);
  });

  it("returns null for a malformed versus slug", () => {
    expect(parseVersusSlug("cursor")).toBeNull();
    expect(parseVersusSlug("a-vs-b-vs-c")).toBeNull();
  });

  it("no tool slug contains the -vs- delimiter (split is unambiguous)", () => {
    expect(tools.every((t) => !t.slug.includes("-vs-"))).toBe(true);
  });
});

describe("seo: versusPairs", () => {
  it("emits canonical, unique, same-category pairs", () => {
    const pairs = versusPairs(tools);
    expect(pairs.length).toBeGreaterThan(0);
    const slugs = pairs.map((p) => versusSlug(p[0].slug, p[1].slug));
    expect(new Set(slugs).size).toBe(slugs.length); // unique
    for (const [a, b] of pairs) {
      expect(a.categorySlug).toBe(b.categorySlug); // same category
      expect(a.slug < b.slug).toBe(true); // canonical order
    }
  });
});
```

- [ ] **Step 2: Run → fail**.

- [ ] **Step 3: Implement** — `src/lib/seo.ts`:

```ts
import type { Tool } from "@/lib/schemas";

const DELIM = "-vs-";

/** Canonical versus slug: two tool slugs, alphabetical, joined by `-vs-`. */
export function versusSlug(a: string, b: string): string {
  return a < b ? `${a}${DELIM}${b}` : `${b}${DELIM}${a}`;
}

/** Parse a versus slug into exactly two slugs, or null if malformed. */
export function parseVersusSlug(slug: string): [string, string] | null {
  const parts = slug.split(DELIM);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

/**
 * All meaningful comparison pairs: every unordered pair of tools within the
 * same category, in canonical (a.slug < b.slug) order. Cross-category pairs are
 * omitted — comparing a writing tool to a video tool isn't a real decision.
 */
export function versusPairs(tools: Tool[]): [Tool, Tool][] {
  const byCat = new Map<string, Tool[]>();
  for (const t of tools) {
    const list = byCat.get(t.categorySlug) ?? [];
    list.push(t);
    byCat.set(t.categorySlug, list);
  }

  const pairs: [Tool, Tool][] = [];
  for (const list of byCat.values()) {
    const sorted = [...list].sort((a, b) => a.slug.localeCompare(b.slug));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        pairs.push([sorted[i], sorted[j]]);
      }
    }
  }
  return pairs;
}
```

- [ ] **Step 4: Run → pass**; `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(seo): versus slug + same-category pairing helpers"`.

---

## Task 3: Ranked listicle row component

**Files:** Create `src/components/seo/ranked-tool-row.tsx`.

- [ ] **Step 1: Create the component** (server; reuses existing primitives):

```tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";

/**
 * A numbered entry in a "best of" / "alternatives" listicle. Server-rendered,
 * link-first for SEO. `note` is a one-line, deterministic reason.
 */
export function RankedToolRow({
  rank,
  tool,
  note,
}: {
  rank: number;
  tool: Tool;
  note: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-5 ring-hairline">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal/10 font-display text-sm font-semibold text-teal ring-1 ring-teal/20">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ToolLogo name={tool.name} accent={tool.accent} logo={tool.logo} size="sm" />
            <div className="min-w-0">
              <Link
                href={`/tools/${tool.slug}`}
                className="font-display text-lg font-semibold hover:text-teal"
              >
                {tool.name}
              </Link>
              <p className="truncate text-sm text-muted-foreground">{tool.tagline}</p>
            </div>
          </div>
          <PricingBadge model={tool.pricing.model} className="shrink-0" />
        </div>
        <p className="text-sm text-pretty text-muted-foreground">{note}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <StarRating value={tool.rating} size={13} />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {tool.rating.toFixed(1)}
            </span>
          </span>
          <Link
            href={`/tools/${tool.slug}`}
            className="inline-flex items-center gap-1 font-mono text-xs text-teal hover:underline"
          >
            Read review
            <Icon name="ArrowRight" className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** `npm run typecheck` → PASS. Commit — `git commit -m "feat(seo): ranked listicle row component"`.

---

## Task 4: "Best {category}" pages

**Files:** Create `src/app/best/[category]/page.tsx`.

- [ ] **Step 1: Create the page** — full ranked listicle + FAQ + structured data:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { RankedToolRow } from "@/components/seo/ranked-tool-row";
import { JsonLd } from "@/components/seo/json-ld";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from "@/lib/structured-data";
import { getCategories, getCategoryBySlug, getToolsByCategory } from "@/lib/content";

const YEAR = 2026;

export function generateStaticParams() {
  return getCategories().map((c) => ({ category: c.slug }));
}

function ranked(slug: string) {
  return [...getToolsByCategory(slug)].sort(
    (a, b) =>
      b.editorScore - a.editorScore ||
      b.rating - a.rating ||
      b.reviewCount - a.reviewCount ||
      a.name.localeCompare(b.name),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategoryBySlug(category);
  if (!cat) return { title: "Not found" };
  const tools = ranked(category);
  return {
    title: `The ${tools.length} best ${cat.name} AI tools (${YEAR})`,
    description: `Our editors' ranked pick of the best ${cat.name.toLowerCase()} AI tools in ${YEAR}, vetted and scored. ${tools
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ")} and more.`,
    alternates: { canonical: `/best/${category}` },
  };
}

export default async function BestCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getCategoryBySlug(category);
  if (!cat) notFound();

  const tools = ranked(category);
  const top = tools[0];
  const freeTools = tools.filter(
    (t) => t.pricing.model === "free" || t.pricing.model === "freemium",
  );

  const noteFor = (rank: number, t: (typeof tools)[number]) => {
    if (rank === 1) return `Our top ${cat.name.toLowerCase()} pick — editor score ${t.editorScore.toFixed(1)}/10. ${t.verdict}`;
    return t.verdict;
  };

  const faqs = [
    {
      question: `What is the best ${cat.name} AI tool in ${YEAR}?`,
      answer: `${top.name} is our top-rated ${cat.name.toLowerCase()} tool, with an editor score of ${top.editorScore.toFixed(1)}/10. ${top.verdict}`,
    },
    {
      question: `Are there free ${cat.name} AI tools?`,
      answer: freeTools.length
        ? `Yes — ${freeTools.slice(0, 3).map((t) => t.name).join(", ")} offer free or freemium plans.`
        : `Most tools in this category are paid, though several offer free trials.`,
    },
    {
      question: `How does Enki rank ${cat.name} tools?`,
      answer: `Each tool is used in real workflows by our editors and scored on capability, craft, pricing, and trust — independently of any commercial arrangement.`,
    },
  ];

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Best", path: "/best" },
            { name: cat.name, path: `/best/${category}` },
          ]),
          itemListJsonLd(tools.map((t) => ({ name: t.name, url: `/tools/${t.slug}` }))),
          faqJsonLd(faqs),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Best of {YEAR}
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            The {tools.length} best {cat.name} AI tools
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            {cat.description} Ranked by our editors, vetted and scored — updated
            for {YEAR}.
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <Link href={`/categories/${category}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
              Browse all {cat.name}
            </Link>
            <Link href="/compare" className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
              Compare tools
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {tools.map((t, i) => (
            <RankedToolRow key={t.slug} rank={i + 1} tool={t} note={noteFor(i + 1, t)} />
          ))}
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Frequently asked
          </h2>
          <div className="flex flex-col gap-3">
            {faqs.map((f) => (
              <div key={f.question} className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
                <h3 className="flex items-start gap-2 font-display text-base font-semibold">
                  <Icon name="MessagesSquare" className="mt-0.5 size-4 shrink-0 text-teal" />
                  {f.question}
                </h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2:** `npm run typecheck && npm run build` → PASS; route list shows `● /best/[category]` with 8 params. Commit — `git commit -m "feat(seo): Best {category} landing pages"`.

---

## Task 5: "Alternatives to {tool}" pages

**Files:** Create `src/app/alternatives/[slug]/page.tsx`.

- [ ] **Step 1: Create the page:**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { RankedToolRow } from "@/components/seo/ranked-tool-row";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/structured-data";
import { getAllTools, getToolBySlug, getRelatedTools, getCategoryBySlug } from "@/lib/content";

export function generateStaticParams() {
  return getAllTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Not found" };
  const alts = getRelatedTools(tool, 6);
  return {
    title: `${alts.length} best ${tool.name} alternatives (2026)`,
    description: `Looking for an alternative to ${tool.name}? Our editors' vetted picks: ${alts
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ")} and more.`,
    alternates: { canonical: `/alternatives/${slug}` },
  };
}

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const alts = getRelatedTools(tool, 6);
  const category = getCategoryBySlug(tool.categorySlug);

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: tool.name, path: `/tools/${tool.slug}` },
            { name: "Alternatives", path: `/alternatives/${slug}` },
          ]),
          itemListJsonLd(alts.map((t) => ({ name: t.name, url: `/tools/${t.slug}` }))),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Alternatives
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            The best {tool.name} alternatives
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            {tool.name} is a strong {category?.name.toLowerCase() ?? "AI"} tool,
            but it isn&apos;t the only option. Here are the vetted alternatives our
            editors rate most highly.
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <Link href={`/tools/${tool.slug}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
              Read our {tool.name} review
            </Link>
            {category && (
              <Link href={`/best/${category.slug}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
                Best {category.name}
              </Link>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {alts.map((t, i) => (
            <RankedToolRow
              key={t.slug}
              rank={i + 1}
              tool={t}
              note={
                t.categorySlug === tool.categorySlug
                  ? `A direct ${category?.name.toLowerCase() ?? ""} alternative. ${t.verdict}`
                  : t.verdict
              }
            />
          ))}
        </div>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Scale" className="size-4 text-teal" />
          Compare any of these head-to-head on the{" "}
          <Link href="/compare" className="text-teal hover:underline">
            compare page
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2:** `npm run typecheck && npm run build` → PASS; `● /alternatives/[slug]` (27). Commit — `git commit -m "feat(seo): Alternatives-to-{tool} pages"`.

---

## Task 6: "{A} vs {B}" pages

**Files:** Create `src/app/vs/[versus]/page.tsx`.

- [ ] **Step 1: Create the page** — static side-by-side + verdict + FAQ:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { ToolLogo } from "@/components/shared/tool-logo";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { StarRating } from "@/components/shared/star-rating";
import { Icon } from "@/components/shared/icon";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/structured-data";
import { getAllTools, getToolBySlug, getCategoryBySlug } from "@/lib/content";
import { parseVersusSlug, versusPairs, versusSlug } from "@/lib/seo";
import type { Tool } from "@/lib/schemas";

export function generateStaticParams() {
  return versusPairs(getAllTools()).map(([a, b]) => ({
    versus: versusSlug(a.slug, b.slug),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ versus: string }>;
}): Promise<Metadata> {
  const { versus } = await params;
  const parsed = parseVersusSlug(versus);
  if (!parsed) return { title: "Not found" };
  const a = getToolBySlug(parsed[0]);
  const b = getToolBySlug(parsed[1]);
  if (!a || !b) return { title: "Not found" };
  return {
    title: `${a.name} vs ${b.name}: which is better? (2026)`,
    description: `${a.name} vs ${b.name} compared on editor score, pricing, and features. Our verdict on which AI tool to choose in 2026.`,
    alternates: { canonical: `/vs/${versusSlug(a.slug, b.slug)}` },
  };
}

export default async function VersusPage({
  params,
}: {
  params: Promise<{ versus: string }>;
}) {
  const { versus } = await params;
  const parsed = parseVersusSlug(versus);
  if (!parsed) notFound();
  const a = getToolBySlug(parsed[0]);
  const b = getToolBySlug(parsed[1]);
  if (!a || !b) notFound();

  const winner = a.editorScore >= b.editorScore ? a : b;
  const loser = winner === a ? b : a;
  const category = getCategoryBySlug(a.categorySlug);

  const faqs = [
    {
      question: `Is ${a.name} better than ${b.name}?`,
      answer: `By our editors' scoring, ${winner.name} edges ahead (${winner.editorScore.toFixed(1)} vs ${loser.editorScore.toFixed(1)} out of 10), but the right choice depends on your needs — ${loser.name} leads on ${loser.pros[0]?.toLowerCase() ?? "certain workflows"}.`,
    },
    {
      question: `How much do ${a.name} and ${b.name} cost?`,
      answer: `${a.name}: ${priceLine(a)}. ${b.name}: ${priceLine(b)}.`,
    },
  ];

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: `${a.name} vs ${b.name}`, path: `/vs/${versus}` },
          ]),
          faqJsonLd(faqs),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Head to head
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            {a.name} vs {b.name}
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Two {category?.name.toLowerCase() ?? "AI"} tools compared on our
            editor score, community rating, pricing, and the trade-offs that
            actually matter.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {[a, b].map((t) => (
            <div key={t.slug} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center ring-hairline">
              <ToolLogo name={t.name} accent={t.accent} logo={t.logo} size="lg" />
              <Link href={`/tools/${t.slug}`} className="font-display text-xl font-semibold hover:text-teal">
                {t.name}
              </Link>
              <span className="font-mono text-3xl font-semibold text-teal tabular-nums">
                {t.editorScore.toFixed(1)}
              </span>
              <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                Editor score
              </span>
              <StarRating value={t.rating} size={14} />
              <PricingBadge model={t.pricing.model} />
            </div>
          ))}
        </div>

        {/* Attribute table */}
        <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
          <Row label="Editor score" a={`${a.editorScore.toFixed(1)} / 10`} b={`${b.editorScore.toFixed(1)} / 10`} />
          <Row label="Community rating" a={`${a.rating.toFixed(1)} ★`} b={`${b.rating.toFixed(1)} ★`} />
          <Row label="Pricing" a={priceLine(a)} b={priceLine(b)} />
          <Row label="Best for" a={a.pros[0] ?? "—"} b={b.pros[0] ?? "—"} />
          <Row label="Watch out" a={a.cons[0] ?? "—"} b={b.cons[0] ?? "—"} />
        </div>

        {/* Verdict */}
        <div className="rounded-2xl border border-teal/20 bg-teal/5 p-6">
          <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-teal uppercase">
            <Icon name="BadgeCheck" className="size-4" />
            Enki verdict
          </p>
          <p className="mt-2 text-pretty">
            {winner.name} takes the edge with a {winner.editorScore.toFixed(1)}/10
            editor score. {winner.verdict} That said, {loser.name} is the better
            pick if {loser.pros[0]?.toLowerCase() ?? "its strengths"} matter most to you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
            <Link href={`/tools/${a.slug}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
              {a.name} review
            </Link>
            <Link href={`/tools/${b.slug}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground">
              {b.name} review
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-semibold">Frequently asked</h2>
          {faqs.map((f) => (
            <div key={f.question} className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
              <h3 className="font-display text-base font-semibold">{f.question}</h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </section>
      </div>
    </Container>
  );
}

function priceLine(t: Tool): string {
  const model = t.pricing.model[0].toUpperCase() + t.pricing.model.slice(1);
  return t.pricing.startingPrice ? `${model}, from ${t.pricing.startingPrice}` : model;
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.2fr] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-pretty">{a}</span>
      <span className="text-pretty">{b}</span>
    </div>
  );
}
```

- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run build` → PASS; `● /vs/[versus]` (~30–40). Commit — `git commit -m "feat(seo): head-to-head {A} vs {B} pages"`.

---

## Task 7: llms.txt, sitemap, and internal links

**Files:** Create `src/app/llms.txt/route.ts`; Modify `src/app/sitemap.ts`, `src/app/tools/[slug]/page.tsx`, `src/app/categories/[slug]/page.tsx`.

- [ ] **Step 1: `src/app/llms.txt/route.ts`** — plain-text site guide for LLMs:

```ts
import { getAllTools, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const base = siteConfig.url;
  const categories = getCategories();
  const tools = getAllTools();

  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "## Categories",
    ...categories.map((c) => `- [${c.name}](${base}/best/${c.slug}): ${c.tagline}`),
    "",
    "## Tools",
    ...tools.map((t) => `- [${t.name}](${base}/tools/${t.slug}): ${t.tagline}`),
    "",
    "## Key pages",
    `- [Directory](${base}/tools): browse and filter every vetted tool`,
    `- [Finder](${base}/finder): guided recommendations`,
    `- [Compare](${base}/compare): put tools head to head`,
    `- [Leaderboards](${base}/leaderboards): top tools by editor and community score`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 2: Sitemap** — in `src/app/sitemap.ts`, add the three families. Add imports for `versusPairs`, `versusSlug` from `@/lib/seo`, and after the `categories` block:

```ts
  const best: MetadataRoute.Sitemap = getCategories().map((c) => ({
    url: `${base}/best/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const alternatives: MetadataRoute.Sitemap = getAllTools().map((t) => ({
    url: `${base}/alternatives/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const versus: MetadataRoute.Sitemap = versusPairs(getAllTools()).map(([a, b]) => ({
    url: `${base}/vs/${versusSlug(a.slug, b.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
```

and include them in the returned array: `return [...staticRoutes, ...tools, ...categories, ...best, ...alternatives, ...versus];`

- [ ] **Step 3: Tool page internal links** — in `src/app/tools/[slug]/page.tsx`, in the "Related tools" section (near the bottom), add links to the alternatives page and a couple of vs pages. Right after the `SectionLabel` for Related tools, add:

```tsx
            <Link
              href={`/alternatives/${tool.slug}`}
              className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-teal hover:underline"
            >
              See all {tool.name} alternatives
              <Icon name="ArrowRight" className="size-3" />
            </Link>
```

(`Link` and `Icon` are already imported in that file.)

- [ ] **Step 4: Category page link** — in `src/app/categories/[slug]/page.tsx`, near the category hero heading/description, add a link to the Best page. After the `toolCount ... vetted` line, add:

```tsx
              <Link
                href={`/best/${category.slug}`}
                className="mt-3 inline-flex w-fit items-center gap-1 font-mono text-xs text-teal hover:underline"
              >
                See the best {category.name} tools, ranked
                <Icon name="ArrowRight" className="size-3" />
              </Link>
```

(Confirm `Link` and `Icon` are imported in that file; both are.)

- [ ] **Step 5:** `npm run typecheck && npm run lint && npm run build` → PASS. Commit — `git commit -m "feat(seo): llms.txt, sitemap coverage, and internal links"`.

---

## Final Verification Phase

- [ ] **V1: Static gates** — `typecheck && lint && test && build` all PASS. Build route list shows `● /best/[category]`, `● /alternatives/[slug]`, `● /vs/[versus]` with their static counts; unit count up (structured-data 3, seo ~6).

- [ ] **V2: Route + structured-data (live)** — serve prod; for a sample of each family (`/best/coding`, `/alternatives/cursor`, `/vs/cursor-vs-windsurf`, `/llms.txt`):
  - `curl -s <url>` → 200, correct `<title>`, and a `<script type="application/ld+json">` present. Extract and `JSON.parse` each JSON-LD block → valid; confirm `ItemList`/`FAQPage`/`BreadcrumbList` `@type`s.
  - `curl -s /llms.txt` → `text/plain`, lists categories + tools.
  - `curl -s /sitemap.xml | grep -c '/vs/'` → matches the versus count.
  - `curl -sI /vs/windsurf-vs-cursor` (reversed) → renders, and its HTML `<link rel="canonical">` points to the canonical `cursor-vs-windsurf`.

- [ ] **V3: Visual sweep** (CLAUDE.md → Visual Sweep):
  - `/best/coding`, `/alternatives/cursor`, `/vs/cursor-vs-windsurf` — render on-brand; measure no overflow (the vs 3-col table + 2-col cards fit; ranked rows don't clip); console clean; test mobile width (vs grid + table reflow).
  - Regression check `/` and `/tools` and a `/tools/<slug>` (new internal links present, no layout shift), console clean.

- [ ] **V4: Report** — gates, route counts, parsed JSON-LD types, measurements.

---

## Self-Review
- **Coverage:** JSON-LD builders (T1) ✓; versus/pairs helpers (T2) ✓; listicle component (T3) ✓; best pages (T4) ✓; alternatives pages (T5) ✓; vs pages (T6) ✓; llms.txt + sitemap + internal links (T7) ✓; structured-data + visual verification (Final) ✓.
- **Placeholders:** none — full code in every step.
- **Type consistency:** `versusSlug`, `parseVersusSlug`, `versusPairs`, `itemListJsonLd`, `faqJsonLd`, `breadcrumbJsonLd`, `RankedToolRow` defined then used consistently across pages/sitemap.
- **SSG-stable:** `YEAR` is a constant (no `Date` in render); versus canonicalization prevents duplicate-content; all copy deterministic and honest (no fabricated quotes).
- **Deferred:** RSS feed (no honest per-tool timestamps yet) — revisit after the CMS adds real `createdAt`/`updatedAt`.
