/**
 * News search input handling, kept pure so it can be tested without a database.
 *
 * A term keeps only letters, digits, apostrophes, hyphens and a few symbols
 * that appear in AI news ("$100", "C++"). Everything PostgREST treats as
 * syntax inside an `or=(...)` filter (commas, parentheses, dots, quotes,
 * asterisks) and SQL LIKE wildcards (% and _) is stripped.
 */

export const SEARCH_QUERY_MAX = 80;
export const SEARCH_MAX_TERMS = 5;
const SEARCH_MIN_TERM = 2;

export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_QUERY_MAX);
}

export function searchTerms(query: string): string[] {
  const terms = normalizeQuery(query)
    .toLowerCase()
    .split(" ")
    .map((t) => t.replace(/[^\p{L}\p{N}'$+&-]/gu, ""))
    .filter((t) => t.length >= SEARCH_MIN_TERM);
  return [...new Set(terms)].slice(0, SEARCH_MAX_TERMS);
}
