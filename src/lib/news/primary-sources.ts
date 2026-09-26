import { parseArticleBody, type Inline } from "@/lib/news/article-body";

/**
 * Primary sources: the company, lab, regulator, court or paper a story is
 * about, as opposed to the outlets that reported on it. A story lists them
 * first, labelled, whenever its sources or body link to one.
 *
 * Matched on the link's host (exact or subdomain), so "openai.com" covers
 * "help.openai.com" but "notopenai.com" never matches.
 */
const PRIMARY_HOSTS = [
  "openai.com",
  "anthropic.com",
  "claude.com",
  "blog.google",
  "deepmind.google",
  "ai.google",
  "research.google",
  "ai.meta.com",
  "about.fb.com",
  "microsoft.com",
  "nvidia.com",
  "apple.com",
  "amazon.com",
  "aboutamazon.com",
  "mistral.ai",
  "x.ai",
  "huggingface.co",
  "arxiv.org",
  "biorxiv.org",
  "nature.com",
  "science.org",
  "sec.gov",
  "europa.eu",
  "gov.uk",
  "whitehouse.gov",
  "courtlistener.com",
];

/** Government sites by public suffix (.gov, .gov.au, .gov.uk, .gc.ca and the like). */
const GOVERNMENT = /(^|\.)(gov|mil)(\.[a-z]{2})?$|(^|\.)gc\.ca$/;

export function isPrimaryUrl(url: string): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (GOVERNMENT.test(host)) return true;
  return PRIMARY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export type SourceLink = { name: string; url: string };

function links(inlines: Inline[]): SourceLink[] {
  return inlines.flatMap((p) => (p.type === "link" ? [{ name: p.text, url: p.href }] : []));
}

/** Primary-source links in a body, first occurrence of each URL, in reading order. */
export function primaryLinksInBody(body: string | null): SourceLink[] {
  if (!body) return [];
  const found = parseArticleBody(body).flatMap((block) => {
    if (block.type === "paragraph") return links(block.inlines);
    if (block.type === "list") return block.items.flatMap(links);
    return [];
  });
  const seen = new Set<string>();
  return found.filter((l) => isPrimaryUrl(l.url) && !seen.has(l.url) && seen.add(l.url));
}

/** Splits a story's sources into primary material and the reporting it drew on. */
export function splitSources<T extends { url: string }>(
  sources: T[],
  body: string | null,
): { primary: SourceLink[]; reporting: T[] } {
  const primarySources = sources.filter((s) => isPrimaryUrl(s.url));
  const reporting = sources.filter((s) => !isPrimaryUrl(s.url));
  const fromSources: SourceLink[] = primarySources.map((s) => ({
    name: "name" in s && typeof s.name === "string" ? s.name : new URL(s.url).hostname,
    url: s.url,
  }));
  const seen = new Set(fromSources.map((s) => s.url));
  const fromBody = primaryLinksInBody(body).filter((l) => !seen.has(l.url));
  return { primary: [...fromSources, ...fromBody], reporting };
}
