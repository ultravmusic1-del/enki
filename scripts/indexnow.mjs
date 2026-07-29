#!/usr/bin/env node
/**
 * `pnpm indexnow` — push URLs to the IndexNow engines.
 *
 *   pnpm indexnow                    submit every URL in the live sitemap
 *   pnpm indexnow <url> [<url>...]   submit specific URLs
 *   pnpm indexnow --dry-run          print the payload, submit nothing
 *
 * One POST reaches Bing, Yandex, Naver, Seznam.cz, Yep and Amazon — and via
 * Bing's index, DuckDuckGo and Copilot/ChatGPT search. Google does not
 * participate; Brave has no submission API at all.
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
// as plain Node ESM with no TypeScript build step; the drift test in
// src/lib/indexnow.test.ts is what pins these to the canonical values.
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
    throw new Error(
      `Could not fetch ${ORIGIN}/sitemap.xml — HTTP ${res.status}`,
    );
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
