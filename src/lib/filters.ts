import type { PricingModel, Tool } from "@/lib/schemas";

export type SortKey = "relevance" | "rating" | "reviews" | "name" | "newest";

export type ToolFilters = {
  /** Category slug; undefined or "all" means every category. */
  category?: string;
  /** Pricing models to include; empty means all. */
  pricing?: PricingModel[];
  /** Minimum aggregate rating (inclusive). */
  minRating?: number;
  /** Tags to match; a tool passes if it has ANY of them (OR). */
  tags?: string[];
};

/** Pure, order-preserving filter. Search (Fuse) is applied separately. */
export function applyFilters(tools: Tool[], filters: ToolFilters): Tool[] {
  const { category, pricing, minRating, tags } = filters;
  return tools.filter((tool) => {
    if (category && category !== "all" && tool.categorySlug !== category) {
      return false;
    }
    if (pricing && pricing.length > 0 && !pricing.includes(tool.pricing.model)) {
      return false;
    }
    if (minRating && tool.rating < minRating) {
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
    case "rating":
      return list.sort(
        (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      );
    case "reviews":
      return list.sort((a, b) => b.reviewCount - a.reviewCount);
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return list.sort((a, b) => b.foundedYear - a.foundedYear);
    case "relevance":
    default:
      return list;
  }
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
  { value: "rating", label: "Top rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A–Z)" },
];
