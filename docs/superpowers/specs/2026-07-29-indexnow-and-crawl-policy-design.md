# IndexNow and Crawl Policy Design

**Date:** 2026-07-29 · **Baseline:** `5a1e391` · **Domain:** `enkitools.com`
**Goal:** push new and changed URLs to the non-Google engines the moment they exist, and
make Enki's index-control directives say one thing instead of two contradictory things.

Follows the enkitools.com migration
(`docs/superpowers/specs/2026-07-29-seo-domain-migration-design.md`), which is deployed.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Submission trigger | **Manual script.** No deploy hook, no persisted state. |
| Key storage | **Committed to the repo.** The IndexNow key is public by definition. |
| URL source | **The live `sitemap.xml`**, fetched over HTTP. |
| Crawl policy | **Allow crawling everywhere; rely on `noindex`.** `Disallow` list emptied. |

---

## 2. Why IndexNow, and why not Brave

IndexNow is a push protocol: instead of waiting to be crawled, the site tells participating
engines a URL has changed. One POST to `api.indexnow.org` fans out to **Bing, Yandex,
Naver, Seznam.cz, Yep and Amazon**.

The reach is larger than the list suggests, because Bing's index also backs **DuckDuckGo,
Copilot and ChatGPT search**. Google does not participate and has never adopted it.

**Brave is deliberately out of scope.** It has no webmaster console, no bulk submission
endpoint, and does not support IndexNow — only a single-URL re-fetch form at
`search.brave.com/submit-url`. Brave's crawler advertises no distinct user agent and, per
Brave's own documentation, will not crawl anything Googlebot cannot crawl. Brave
visibility is therefore a consequence of ordinary Google-facing technical SEO, which the
previous migration already handled. There is nothing to build.

*(Note for future readers: several high-ranking guides describe a "Brave Webmaster Tools"
dashboard at `search.brave.com/webmaster`. That URL returns 404. The guides are
AI-generated and wrong.)*

---

## 3. Why manual submission

Automatic post-deploy submission was rejected. Enki auto-deploys on every push to `main`,
and most pushes change code, not content. Re-submitting all 111 URLs because a CSS value
changed is precisely the behaviour IndexNow asks publishers not to exhibit, and invites
throttling or being ignored outright.

A change-aware postbuild diff was also rejected: it needs state persisted across builds —
a committed snapshot file or a Supabase table — which is disproportionate infrastructure
for a 27-tool directory whose content changes when a human adds a tool.

Manual submission matches how the content actually changes: an operator adds or edits a
tool, then pushes the affected URLs. The one-time bulk submission of all 111 URLs is
legitimate for a site that has never been submitted; routine use afterwards is a handful
of URLs at a time.

---

## 4. Components

### `public/80d4903b0e117a36e950cc97f99bf86b.txt`

Contains exactly the key `80d4903b0e117a36e950cc97f99bf86b` and nothing else. Served at
`https://enkitools.com/80d4903b0e117a36e950cc97f99bf86b.txt`, which is how the protocol
proves the submitter controls the host.

The key is **not a secret**. It is fetched openly by search engines, so committing it is
correct and keeps the file and the code that references it from drifting apart. A key must
be 8–128 characters of `[a-zA-Z0-9-]`; this is 32 hex characters.

### `src/lib/indexnow.ts`

Pure, no I/O, unit-testable:

- `INDEXNOW_KEY` — the key, as a constant
- `keyLocation()` — the absolute URL of the key file
- `assertSubmittable(urls)` — throws unless every URL is `https://` on the canonical host
- `buildSubmission(urls)` — returns `{ host, key, keyLocation, urlList }`

Host validation is the load-bearing part. It is the guard that stops a stale
`enki-five.vercel.app` URL being submitted: IndexNow requires the key file to live on the
submitted host, so a foreign URL is rejected by the API — but failing locally with a clear
message beats a 422 from a remote service.

### `scripts/indexnow.mjs`

Follows the existing `scripts/*.mjs` convention (`doctor`, `audit:rls`, `sweep`).

```
pnpm indexnow                    # fetch live sitemap.xml, submit every URL in it
pnpm indexnow <url> [<url>...]   # submit specific URLs
pnpm indexnow --dry-run          # print the payload, submit nothing
```

Reading the **live sitemap** rather than importing the content layer is deliberate: it
needs no Supabase credentials, runs anywhere, and guarantees the submission matches what
search engines actually see rather than what a local build believes.

POSTs JSON to `https://api.indexnow.org/indexnow`.

### Error handling

A silent failure is the worst outcome here — the operator would believe URLs were
submitted when they were not. Status codes are therefore mapped to actionable text:

| Status | Meaning reported |
|---|---|
| `200` | Submitted and accepted |
| `202` | Accepted; key validation pending |
| `400` | Malformed request — a bug in the payload builder |
| `403` | Key file not reachable at its location, or does not match |
| `422` | URLs do not belong to the submitted host |
| `429` | Rate limited — too many submissions |

Any non-2xx exits non-zero so the failure is visible to a caller or a CI step.

---

## 5. Crawl policy

`robots.txt` currently disallows `/saved`, `/admin` and `/collections`. Two of those also
carry `robots: { index: false, follow: false }`. Those directives cancel out: a crawler
blocked by `robots.txt` never fetches the page, so it never sees the `noindex`, and the
bare URL can still surface in results without a snippet. Brave's documentation states the
general rule plainly — robots.txt is not a mechanism for preventing indexing.

`/saved` is worse: it is disallowed, carries **no** `noindex`, and sets a self-canonical
of `/saved` — a directive that actively asks to be indexed.

Resolution — one mechanism, applied consistently:

- **`src/app/robots.ts`** — the `Disallow` list is emptied. Everything is crawlable.
- **`src/app/saved/page.tsx`** — gains `robots: { index: false, follow: false }`, and
  **loses** `alternates.canonical`. A self-canonical asserts "this is the indexable
  version of this page" while `noindex` asserts "do not index this page"; the two should
  not appear together.

`/collections`, `/admin`, `/account` and `/unsubscribe` already carry `noindex` and need
no change — emptying the `Disallow` list is what finally makes their `noindex` visible.

No sitemap change: `/saved`, `/collections` and `/admin` were never listed in it.

---

## 6. Testing

`src/lib/indexnow.test.ts`:

- `buildSubmission` produces the exact documented payload shape
- the key satisfies the protocol's format rule (8–128 chars, `[a-zA-Z0-9-]`)
- `keyLocation()` resolves against the canonical origin
- `assertSubmittable` rejects a foreign host
- `assertSubmittable` rejects an `enki-five.vercel.app` URL specifically — the regression
  the previous migration existed to prevent
- `assertSubmittable` rejects a non-`https` URL

The script itself is not unit-tested; it is exercised by `--dry-run` against the live
sitemap during verification.

---

## 7. Verification

Local: `pnpm verify`, then `pnpm indexnow --dry-run` and confirm 111 URLs, all on
`enkitools.com`.

After deploy:

| Check | Expected |
|---|---|
| `https://enkitools.com/80d4903b0e117a36e950cc97f99bf86b.txt` | `200`, body is the key |
| `https://enkitools.com/robots.txt` | no `Disallow` lines |
| `https://enkitools.com/saved` | `<meta name="robots" content="noindex,nofollow">`, no canonical |
| `https://enkitools.com/collections` | `noindex` present and now crawlable |
| `pnpm indexnow` | `200` or `202` |

No `.tsx` render output changes — `/saved`'s edit is metadata only — so no visual sweep is
required. This is stated explicitly rather than silently skipped.

---

## 8. Out of scope

- **Google** does not support IndexNow; its indexing continues via sitemap and crawl.
- **Brave**, for the reasons in §2.
- **Bing Webmaster Tools** account setup — a console action for the operator, best done
  after Search Console so its "Import from Google Search Console" shortcut applies.
- Thin-content risk on the generated `/best`, `/alternatives` and `/vs` pages, still
  deferred from the previous spec.
