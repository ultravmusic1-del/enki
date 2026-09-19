/**
 * News beats: the fixed sections stories are filed under.
 *
 * Deliberately separate from directory categories. News breaks along lines
 * like funding rounds and regulation that no tool category covers.
 * `stories.beat` has a check constraint listing these slugs; keep them in step.
 */
export const beats = [
  { slug: "models-labs", name: "Models & Labs" },
  { slug: "products-launches", name: "Products & Launches" },
  { slug: "funding-business", name: "Funding & Business" },
  { slug: "policy-safety", name: "Policy & Safety" },
  { slug: "research", name: "Research" },
] as const;

export type Beat = (typeof beats)[number];
export type BeatSlug = Beat["slug"];

export const beatSlugs = beats.map((b) => b.slug) as [BeatSlug, ...BeatSlug[]];

export function getBeat(slug: string): Beat | undefined {
  return beats.find((b) => b.slug === slug);
}
