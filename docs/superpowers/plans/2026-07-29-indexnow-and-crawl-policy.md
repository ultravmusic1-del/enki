# IndexNow and Crawl Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual IndexNow submission for Bing/Yandex/Naver/Seznam/Yep, and replace
Enki's contradictory `Disallow`+`noindex` directives with a single consistent mechanism.

**Architecture:** A pure `src/lib/indexnow.ts` builds and validates the submission payload;
`scripts/indexnow.mjs` does the I/O (fetch the live sitemap, POST to the API). Crawl policy
is two small metadata edits. Nothing runs automatically — submission is operator-invoked.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Node ESM scripts, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-29-indexnow-and-crawl-policy-design.md`

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `public/80d4903b0e117a36e950cc97f99bf86b.txt` | Create | Ownership proof fetched by the engines |
| `src/lib/indexnow.ts` | Create | Payload construction + host validation (pure) |
| `src/lib/indexnow.test.ts` | Create | Locks payload shape and the host guard |
| `scripts/indexnow.mjs` | Create | CLI: sitemap fetch, POST, status mapping |
| `package.json` | Modify | `indexnow` script entry |
| `src/app/robots.ts` | Modify | Empty the `Disallow` list |
| `src/app/saved/page.tsx` | Modify | Add `noindex`, remove self-canonical |

---

## Task 1: The key file

**Files:**
- Create: `public/80d4903b0e117a36e950cc97f99bf86b.txt`

- [ ] **Step 1: Create the file**

Contents — exactly this one line, no trailing commentary:

```
80d4903b0e117a36e950cc97f99bf86b
```

- [ ] **Step 2: Confirm it will be served verbatim**

```bash
cat public/80d4903b0e117a36e950cc97f99bf86b.txt
```

Expected: `80d4903b0e117a36e950cc97f99bf86b`

Files in `public/` are served from the root, so this becomes
`https://enkitools.com/80d4903b0e117a36e950cc97f99bf86b.txt`.

- [ ] **Step 3: Commit**

```bash
git add public/80d4903b0e117a36e950cc97f99bf86b.txt
git commit -m "feat(seo): IndexNow ownership key"
```

---

## Task 2: Payload builder and host guard

**Files:**
- Create: `src/lib/indexnow.ts`
- Test: `src/lib/indexnow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/indexnow.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  assertSubmittable,
  buildSubmission,
  keyLocation,
} from "@/lib/indexnow";

describe("indexnow key", () => {
  it("satisfies the protocol's format rule", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });

  it("resolves the key file against the canonical origin", () => {
    expect(keyLocation()).toBe(
      `https://enkitools.com/${INDEXNOW_KEY}.txt`,
    );
  });
});

describe("assertSubmittable", () => {
  it("accepts URLs on the canonical host", () => {
    expect(() =>
      assertSubmittable([
        "https://enkitools.com/",
        "https://enkitools.com/tools/cursor",
      ]),
    ).not.toThrow();
  });

  it("rejects a foreign host", () => {
    expect(() => assertSubmittable(["https://example.com/tools"])).toThrow(
      /enkitools\.com/,
    );
  });

  // The regression the domain migration existed to prevent: a stale Vercel URL
  // must never be submitted. IndexNow would reject it anyway, because the key
  // file does not live on that host — failing here gives a clearer message.
  it("rejects the old vercel origin", () => {
    expect(() =>
      assertSubmittable(["https://enki-five.vercel.app/tools"]),
    ).toThrow(/enkitools\.com/);
  });

  it("rejects a non-https URL", () => {
    expect(() => assertSubmittable(["http://enkitools.com/"])).toThrow(/https/);
  });

  it("rejects an empty list", () => {
    expect(() => assertSubmittable([])).toThrow(/no urls/i);
  });
});

describe("buildSubmission", () => {
  it("produces the documented payload shape", () => {
    expect(buildSubmission(["https://enkitools.com/tools"])).toEqual({
      host: "enkitools.com",
      key: INDEXNOW_KEY,
      keyLocation: keyLocation(),
      urlList: ["https://enkitools.com/tools"],
    });
  });
});

// scripts/indexnow.mjs is plain Node ESM and cannot import this TypeScript
// module, so it repeats the key and origin as literals. Rotate the key in one
// place and forget the other and every submission 403s, because the key sent
// would no longer match the published file. This pins them together.
describe("script/library drift", () => {
  it("scripts/indexnow.mjs uses the same key and origin", () => {
    const script = readFileSync(
      new URL("../../scripts/indexnow.mjs", import.meta.url),
      "utf8",
    );
    expect(script).toContain(`const KEY = "${INDEXNOW_KEY}"`);
    expect(script).toContain(`const HOST = "${INDEXNOW_HOST}"`);
  });

  it("public/ serves a key file matching the key", () => {
    const file = readFileSync(
      new URL(`../../public/${INDEXNOW_KEY}.txt`, import.meta.url),
      "utf8",
    );
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/lib/indexnow.test.ts
```

Expected: FAIL — cannot resolve `@/lib/indexnow`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/indexnow.ts`:

```ts
import { CANONICAL_SITE_URL } from "@/lib/site";

/**
 * IndexNow submission payload construction.
 *
 * IndexNow is a push protocol: instead of waiting to be crawled, the site tells
 * participating engines that a URL has changed. One POST to api.indexnow.org
 * reaches Bing, Yandex, Naver, Seznam.cz, Yep and Amazon — and via Bing's index,
 * DuckDuckGo and Copilot/ChatGPT search. Google does not participate.
 *
 * This module is deliberately pure: all I/O lives in scripts/indexnow.mjs, so
 * the payload rules can be unit-tested without a network.
 */

/**
 * Proof that the submitter controls the host. NOT a secret — search engines
 * fetch it openly at `keyLocation()`, which is exactly the point. It is
 * committed so the published file and this constant cannot drift apart.
 */
export const INDEXNOW_KEY = "80d4903b0e117a36e950cc97f99bf86b";

/** The canonical host, without protocol — the shape IndexNow's `host` wants. */
export const INDEXNOW_HOST = new URL(CANONICAL_SITE_URL).host;

/** Absolute URL of the key file, served from `public/`. */
export function keyLocation(): string {
  return `${CANONICAL_SITE_URL}/${INDEXNOW_KEY}.txt`;
}

/**
 * Reject anything IndexNow would refuse, with a clearer message than the API's.
 *
 * The host check is load-bearing: IndexNow requires the key file to live on the
 * submitted host, so a URL on any other origin is invalid. It is also the guard
 * against re-submitting a stale enki-five.vercel.app URL after the domain
 * migration.
 */
export function assertSubmittable(urls: string[]): void {
  if (urls.length === 0) {
    throw new Error("No URLs to submit.");
  }
  for (const raw of urls) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Not a valid URL: ${raw}`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`Must be https: ${raw}`);
    }
    if (url.host !== INDEXNOW_HOST) {
      throw new Error(
        `Refusing to submit ${raw} — IndexNow only accepts URLs on ${INDEXNOW_HOST}, where the key file lives.`,
      );
    }
  }
}

/** The JSON body for a bulk submission. Max 10,000 URLs per request. */
export function buildSubmission(urls: string[]): {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
} {
  assertSubmittable(urls);
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: keyLocation(),
    urlList: urls,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/lib/indexnow.test.ts
```

Expected: PASS, 10 tests.

Note the ordering consequence: the drift tests read `public/<key>.txt` and
`scripts/indexnow.mjs`, so Task 1 must be complete and Task 3's script must exist before
this suite is green. Run Task 3 first if working out of order.

- [ ] **Step 5: Commit**

```bash
git add src/lib/indexnow.ts src/lib/indexnow.test.ts
git commit -m "feat(seo): IndexNow payload builder with host validation"
```

---

## Task 3: The CLI script

**Files:**
- Create: `scripts/indexnow.mjs`
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Write the script**

Create `scripts/indexnow.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm indexnow` — push URLs to the IndexNow engines.
 *
 *   pnpm indexnow                    submit every URL in the live sitemap
 *   pnpm indexnow <url> [<url>...]   submit specific URLs
 *   pnpm indexnow --dry-run          print the payload, submit nothing
 *
 * One POST reaches Bing, Yandex, Naver, Seznam.cz, Yep and Amazon. Google does
 * not participate; Brave has no submission API at all.
 *
 * Deliberately manual. Enki auto-deploys on every push to main and most pushes
 * change code, not content — re-submitting all 111 URLs because a CSS value
 * changed is what the protocol asks publishers not to do. Run this when content
 * actually changes.
 *
 * The URL list comes from the LIVE sitemap, not a local build, so it needs no
 * Supabase credentials and always matches what search engines actually see.
 */
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Mirrors src/lib/indexnow.ts. Kept as literals because this script must run
// as plain Node ESM with no TypeScript build step; the test in
// src/lib/indexnow.test.ts is what pins the canonical values.
const KEY = "80d4903b0e117a36e950cc97f99bf86b";
const ORIGIN = "https://enkitools.com";
const HOST = "enkitools.com";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const explicit = args.filter((a) => !a.startsWith("--"));

/** A non-2xx must be loud: a silent failure looks identical to success. */
const STATUS_MEANING = {
  200: "Submitted and accepted.",
  202: "Accepted — key validation pending.",
  400: "Malformed request — the payload is wrong.",
  403: `Key file not reachable or mismatched. Check ${ORIGIN}/${KEY}.txt`,
  422: `URLs do not belong to ${HOST}.`,
  429: "Rate limited — too many submissions.",
};

async function urlsFromSitemap() {
  const res = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!res.ok) {
    throw new Error(`Could not fetch ${ORIGIN}/sitemap.xml — HTTP ${res.status}`);
  }
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function assertSubmittable(urls) {
  if (urls.length === 0) throw new Error("No URLs to submit.");
  for (const raw of urls) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Not a valid URL: ${raw}`);
    }
    if (url.protocol !== "https:") throw new Error(`Must be https: ${raw}`);
    if (url.host !== HOST) {
      throw new Error(
        `Refusing to submit ${raw} — IndexNow only accepts URLs on ${HOST}, where the key file lives.`,
      );
    }
  }
}

async function main() {
  const urls = explicit.length > 0 ? explicit : await urlsFromSitemap();
  assertSubmittable(urls);

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `${ORIGIN}/${KEY}.txt`,
    urlList: urls,
  };

  console.log(`IndexNow — ${urls.length} URL(s)`);
  console.log(`  source: ${explicit.length > 0 ? "arguments" : "live sitemap"}`);
  for (const u of urls.slice(0, 5)) console.log(`    ${u}`);
  if (urls.length > 5) console.log(`    … and ${urls.length - 5} more`);

  if (dryRun) {
    console.log("\n--dry-run: nothing submitted.");
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  const meaning = STATUS_MEANING[res.status] ?? "Unexpected response.";
  console.log(`\nHTTP ${res.status} — ${meaning}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text) console.error(text.slice(0, 500));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`indexnow: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package script**

In `package.json`, add to the `scripts` block immediately after the `sweep` line:

```json
    "indexnow": "node scripts/indexnow.mjs",
```

- [ ] **Step 3: Verify the dry run against the live sitemap**

```bash
pnpm indexnow --dry-run
```

Expected: `IndexNow — 111 URL(s)`, source `live sitemap`, first five URLs all on
`https://enkitools.com`, and `--dry-run: nothing submitted.` Exit code 0.

- [ ] **Step 4: Verify the host guard rejects a foreign URL**

```bash
pnpm indexnow https://example.com/x --dry-run
```

Expected: exits non-zero with
`indexnow: Refusing to submit https://example.com/x — IndexNow only accepts URLs on enkitools.com, where the key file lives.`

- [ ] **Step 5: Commit**

```bash
git add scripts/indexnow.mjs package.json
git commit -m "feat(seo): pnpm indexnow submission script"
```

---

## Task 4: Crawl policy

**Files:**
- Modify: `src/app/robots.ts:5-15`
- Modify: `src/app/saved/page.tsx:6-10`

- [ ] **Step 1: Empty the `Disallow` list**

Replace the body of `src/app/robots.ts`'s `robots()` function:

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    // Everything is crawlable on purpose. Pages that must not be indexed
    // (/saved, /collections, /admin, /account, /unsubscribe) carry a `noindex`
    // in their metadata instead. Disallowing them here would be worse than
    // useless: a blocked crawler never fetches the page, so it never sees the
    // noindex, and the bare URL can still surface in results without a snippet.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
```

- [ ] **Step 2: Fix `/saved`'s contradictory directives**

In `src/app/saved/page.tsx`, replace the `metadata` object:

```ts
export const metadata: Metadata = {
  title: "Saved tools",
  description: "Your shortlist of AI tools, saved for quick access on Enki.",
  // A per-device shortlist with no shared content worth indexing. No canonical:
  // a self-canonical asserts "this is the indexable version of this page",
  // which directly contradicts noindex.
  robots: { index: false, follow: false },
};
```

- [ ] **Step 3: Verify**

```bash
pnpm verify
```

Expected: typecheck, lint, and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/robots.ts src/app/saved/page.tsx
git commit -m "fix(seo): one index-control mechanism instead of two contradictory ones"
```

---

## Task 5: Local verification

**Files:** none modified.

- [ ] **Step 1: Full gate**

```bash
pnpm verify
```

Expected: pass.

- [ ] **Step 2: Production build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 3: Serve it**

```bash
npx next start -p 3100
```

Run in the background; keep it up for Steps 4–6.

- [ ] **Step 4: Key file is served verbatim**

```bash
curl -s localhost:3100/80d4903b0e117a36e950cc97f99bf86b.txt
```

Expected: `80d4903b0e117a36e950cc97f99bf86b`

- [ ] **Step 5: robots.txt has no Disallow**

```bash
curl -s localhost:3100/robots.txt
```

Expected: `Allow: /`, a `Host:` and `Sitemap:` line, and **no** `Disallow:` lines.

- [ ] **Step 6: `/saved` is noindex with no canonical**

```bash
curl -s localhost:3100/saved | grep -oE '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>'
```

Expected: a `<meta name="robots" content="noindex,nofollow">` and **no** canonical link.

- [ ] **Step 7: Stop the server and report**

Stop `next start`. Report Steps 1–6 verbatim.

---

## Post-deploy

Run after the branch merges and Vercel finishes deploying.

- [ ] **Step 1: Key file live**

```bash
curl -s https://enkitools.com/80d4903b0e117a36e950cc97f99bf86b.txt
```

Expected: the key. **This must return 200 before any submission** — IndexNow answers 403
if it cannot fetch the key.

- [ ] **Step 2: Dry run against the live sitemap**

```bash
pnpm indexnow --dry-run
```

Expected: 111 URLs, all `https://enkitools.com`.

- [ ] **Step 3: The real, one-time bulk submission**

```bash
pnpm indexnow
```

Expected: `HTTP 200 — Submitted and accepted.` or `HTTP 202 — Accepted — key validation
pending.` Both are success.

- [ ] **Step 4: Confirm live crawl directives**

```bash
curl -s https://enkitools.com/robots.txt
```

Expected: no `Disallow:` lines.

---

## Operator Checklist

**Bing Webmaster Tools** — a console action, best done now that Search Console is verified
and the sitemap is submitted.

1. <https://www.bing.com/webmasters> → sign in
2. **Import from Google Search Console** — authorise, pick `enkitools.com`. This carries
   over verification and the sitemap in one step, instead of re-verifying by DNS.
3. If the import fails, add the site manually and verify by DNS TXT — same Vercel
   Domains → `enkitools.com` → DNS Records panel used for Google, name left **blank**.
4. Once verified, Bing's **IndexNow** tab will show submitted URLs and their status. That
   is where to check whether the `pnpm indexnow` submission was accepted.

Nothing to do for Brave — it has no console and no submission API. See §2 of the spec.
