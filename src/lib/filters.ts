import type { PricingModel, Tool } from "@/lib/schemas";

/**
 * "rating" and "reviews" are gone: they sorted by an aggregate rating and a
 * review count that no user had contributed. "score" sorts by Enki's editorial
 * score, which is the only ranking signal this project can stand behind.
 */
export type SortKey = "relevance" | "score" | "name" | "newest";

export type ToolFilters = {
  /** Category slug; undefined or "all" means every category. */
  category?: string;
  /** Pricing models to include; empty means all. */
  pricing?: PricingModel[];
  /** Minimum editorial score, 0-10 (inclusive). */
  minScore?: number;
  /** Tags to match; a tool passes if it has ANY of them (OR). */
  tags?: string[];
};

/** Pure, order-preserving filter. Search (Fuse) is applied separately. */
export function applyFilters(tools: Tool[], filters: ToolFilters): Tool[] {
  const { category, pricing, minScore, tags } = filters;
  return tools.filter((tool) => {
    if (category && category !== "all" && tool.categorySlug !== category) {
      return false;
    }
    if (pricing && pricing.length > 0 && !pricing.includes(tool.pricing.model)) {
      return false;
    }
    if (minScore && tool.editorScore < minScore) {
      return false;
    }
    if (tags && tags.length > 0) {
      const has = tags.some((t) => tool.tags.includes(t));
      if (!has) return false;
    }
    return true;
  });
}

/** Stable sort by the given key. "relevance" keeps the incoming order. */
export function sortTools(tools: Tool[], sort: SortKey): Tool[] {
  const list = [...tools];
  switch (sort) {
    case "score":
      return list.sort(
        (a, b) => b.editorScore - a.editorScore || a.name.localeCompare(b.name),
      );
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return list.sort((a, b) => b.foundedYear - a.foundedYear);
    case "relevance":
    default:
      return list;
  }
}

/**
 * Stable partition that pins sponsored tools to the front (preserving their
 * relative order), then everything else in its original order. Use only on
 * *browse* surfaces — never on search results or leaderboards, which must stay
 * merit-ordered. Pure; never mutates the input.
 */
export function pinSponsored(tools: Tool[]): Tool[] {
  const sponsored = tools.filter((t) => t.sponsored);
  if (sponsored.length === 0) return tools;
  const rest = tools.filter((t) => !t.sponsored);
  return [...sponsored, ...rest];
}

/** Unique tags across the given tools, most common first. */
export function getAllTags(tools: Tool[]): string[] {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    for (const tag of tool.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export const PRICING_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "freemium", label: "Freemium" },
  { value: "paid", label: "Paid" },
  { value: "enterprise", label: "Enterprise" },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "score", label: "Editor's score" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A–Z)" },
];
