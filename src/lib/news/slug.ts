const MAX_BASE = 60;

/**
 * A story's public slug: the headline in kebab-case plus the first six
 * characters of its id. The suffix keeps two stories with the same headline
 * apart without a database round trip.
 */
export function makeStorySlug(headline: string, id: string): string {
  const suffix = id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6);
  const base = headline
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${trimAtDash(base, MAX_BASE) || "story"}-${suffix}`;
}

function trimAtDash(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}
