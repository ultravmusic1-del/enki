export type MatchableTool = {
  slug: string;
  name: string;
  aliases?: readonly string[];
};

export const MAX_MATCHES = 5;

/**
 * Names that are also ordinary words ("runway", "cursor", "motion") or that
 * several products share. These match only in their exact casing, so "18
 * months of runway" never tags Runway. Every suggestion is still confirmed by
 * a person before it goes live; this only keeps the queue free of obvious noise.
 */
export const CASE_SENSITIVE_TERMS: ReadonlySet<string> = new Set([
  "Claude",
  "Clay",
  "Consensus",
  "Copilot",
  "Cursor",
  "Elicit",
  "Firefly",
  "Gemini",
  "Mem",
  "Motion",
  "Notion",
  "Perplexity",
  "Pika",
  "Runway",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstIndex(text: string, term: string): number {
  const flags = CASE_SENSITIVE_TERMS.has(term) ? "u" : "iu";
  // A letter or digit on either side means the term is part of a longer word.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
    flags,
  );
  return pattern.exec(text)?.index ?? -1;
}

/** Slugs of the tools `text` mentions, in order of first mention, at most `max`. */
export function matchTools(
  text: string,
  tools: readonly MatchableTool[],
  max: number = MAX_MATCHES,
): string[] {
  const hits: { slug: string; index: number }[] = [];
  for (const tool of tools) {
    let earliest = -1;
    for (const term of [tool.name, ...(tool.aliases ?? [])]) {
      const index = firstIndex(text, term);
      if (index !== -1 && (earliest === -1 || index < earliest)) earliest = index;
    }
    if (earliest !== -1) hits.push({ slug: tool.slug, index: earliest });
  }
  return hits
    .sort((a, b) => a.index - b.index || a.slug.localeCompare(b.slug))
    .slice(0, max)
    .map((hit) => hit.slug);
}
