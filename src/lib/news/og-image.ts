import { siteConfig } from "@/lib/site";
import { isHttpUrl } from "@/lib/safe-url";

/**
 * The article page's own share image, for feed items that carry no image.
 * Hotlinked like feed images; never throws, so it can never fail an ingest.
 */

export const OG_TIMEOUT_MS = 4_000;
export const OG_MAX_BYTES = 1_000_000;
export const OG_MAX_REDIRECTS = 3;

/**
 * Article URLs come from third-party feeds, so every hop must be https on a
 * named public host: no localhost and no IP literals (which covers loopback,
 * private ranges and cloud metadata addresses).
 */
function isSafePageUrl(value: string): boolean {
  if (!value.startsWith("https://") || !isHttpUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.startsWith("[") || /^[0-9.]+$/.test(host)) return false;
  return true;
}

/** In priority order. */
const KEYS = ["og:image:secure_url", "og:image", "twitter:image"];

const META = /<meta\b[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function httpsImage(raw: string, pageUrl: string): string | null {
  try {
    const url = new URL(decodeEntities(raw.trim()), pageUrl).toString();
    return url.startsWith("https://") && isHttpUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export function extractOgImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(META)) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (content && KEYS.includes(key) && !found.has(key)) found.set(key, content);
  }
  for (const key of KEYS) {
    const raw = found.get(key);
    const url = raw ? httpsImage(raw, pageUrl) : null;
    if (url) return url;
  }
  return null;
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < OG_MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text;
}

export async function fetchOgImage(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!isSafePageUrl(url)) return null;
  try {
    const signal = AbortSignal.timeout(OG_TIMEOUT_MS);
    let current = url;
    for (let hop = 0; hop <= OG_MAX_REDIRECTS; hop++) {
      const response = await fetchImpl(current, {
        signal,
        cache: "no-store",
        // Followed by hand so every hop is checked, not just the first.
        redirect: "manual",
        headers: {
          "user-agent": `EnkiNewsBot/1.0 (+${siteConfig.url}/news/about)`,
          accept: "text/html,application/xhtml+xml;q=0.9",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        if (!isSafePageUrl(current)) return null;
        continue;
      }
      if (!response.ok) return null;
      if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("html")) return null;
      return extractOgImage(await readCapped(response), current);
    }
    return null;
  } catch {
    return null;
  }
}
