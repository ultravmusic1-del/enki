import { CANONICAL_SITE_URL } from "@/lib/site";

/* =========================================================================
   IndexNow submission payload construction.

   IndexNow is a push protocol: instead of waiting to be crawled, the site tells
   participating engines that a URL has changed. One POST to api.indexnow.org
   reaches Bing, Yandex, Naver, Seznam.cz, Yep and Amazon — and via Bing's index,
   DuckDuckGo and Copilot/ChatGPT search. Google does not participate.

   This module is deliberately pure: all I/O lives in scripts/indexnow.mjs, so
   the payload rules can be unit-tested without a network.
   ========================================================================= */

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
