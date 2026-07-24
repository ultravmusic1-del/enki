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
