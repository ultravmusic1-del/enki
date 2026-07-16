"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type FuseType from "fuse.js";
import type { Tool } from "@/lib/schemas";
import type { CategoryWithCount } from "@/lib/content";
import {
  applyFilters,
  sortTools,
  PRICING_OPTIONS,
  SORT_OPTIONS,
  type SortKey,
  type ToolFilters,
} from "@/lib/filters";
import type { PricingModel } from "@/lib/schemas";
import { SavableToolCard } from "@/components/shared/savable-tool-card";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 4.5, label: "4.5+" },
  { value: 4.0, label: "4.0+" },
  { value: 3.5, label: "3.5+" },
];

type Props = {
  tools: Tool[];
  categories: CategoryWithCount[];
  tags: string[];
};

export function DirectoryExplorer({ tools, categories, tags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from the URL (once).
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(
    () => searchParams.get("cat") ?? "all",
  );
  const [pricing, setPricing] = useState<PricingModel[]>(() =>
    parseList(searchParams.get("price")) as PricingModel[],
  );
  const [minRating, setMinRating] = useState(() =>
    Number(searchParams.get("rating") ?? 0),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    parseList(searchParams.get("tags")),
  );
  const [sort, setSort] = useState<SortKey>(
    () => (searchParams.get("sort") as SortKey) ?? "relevance",
  );

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  // Lazy-load Fuse for fuzzy search (per plan: dynamic import).
  const [fuse, setFuse] = useState<FuseType<Tool> | null>(null);
  useEffect(() => {
    let active = true;
    void import("fuse.js").then(({ default: Fuse }) => {
      if (!active) return;
      setFuse(
        new Fuse(tools, {
          includeScore: true,
          ignoreLocation: true,
          // Tighter than the Fuse default (0.6): 0.3 keeps fuzzy typo-tolerance
          // but rejects loose matches like "voice"→"video". minMatchCharLength
          // stops single stray characters from matching.
          threshold: 0.3,
          minMatchCharLength: 2,
          keys: [
            { name: "name", weight: 0.35 },
            { name: "tagline", weight: 0.2 },
            { name: "tags", weight: 0.2 },
            {
              name: "categoryName",
              weight: 0.15,
              getFn: (t) => categoryName.get(t.categorySlug) ?? "",
            },
            { name: "description", weight: 0.05 },
            { name: "company", weight: 0.05 },
          ],
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [tools, categoryName]);

  // Sync state → URL (shallow, no scroll jump).
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("cat", category);
    if (pricing.length) params.set("price", pricing.join(","));
    if (minRating) params.set("rating", String(minRating));
    if (selectedTags.length) params.set("tags", selectedTags.join(","));
    if (sort !== "relevance") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, category, pricing, minRating, selectedTags, sort, pathname, router]);

  const results = useMemo(() => {
    const filters: ToolFilters = {
      category,
      pricing,
      minRating,
      tags: selectedTags,
    };

    let base: Tool[];
    const q = query.trim();
    if (q && fuse) {
      base = fuse.search(q).map((r) => r.item);
    } else if (q) {
      const lower = q.toLowerCase();
      base = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.tagline.toLowerCase().includes(lower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lower)),
      );
    } else {
      base = tools;
    }

    const filtered = applyFilters(base, filters);
    // With a query, default to relevance (Fuse order); otherwise default to rating.
    const effectiveSort: SortKey =
      sort === "relevance" && !q ? "rating" : sort;
    return sortTools(filtered, effectiveSort);
  }, [query, category, pricing, minRating, selectedTags, sort, tools, fuse]);

  const togglePricing = useCallback((model: PricingModel) => {
    setPricing((prev) =>
      prev.includes(model)
        ? prev.filter((p) => p !== model)
        : [...prev, model],
    );
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setCategory("all");
    setPricing([]);
    setMinRating(0);
    setSelectedTags([]);
    setSort("relevance");
  }, []);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    pricing.length +
    (minRating ? 1 : 0) +
    selectedTags.length;

  const rail = (
    <FilterRail
      categories={categories}
      tags={tags}
      category={category}
      setCategory={setCategory}
      pricing={pricing}
      togglePricing={togglePricing}
      minRating={minRating}
      setMinRating={setMinRating}
      selectedTags={selectedTags}
      toggleTag={toggleTag}
      activeFilterCount={activeFilterCount}
      clearAll={clearAll}
    />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Desktop rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">{rail}</div>
      </aside>

      <div className="min-w-0">
        {/* Search + sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon
              name="Search"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools by name, use case, or tag…"
              className="h-10 pl-9"
              aria-label="Search tools"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="size-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile filter trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2 lg:hidden">
                  <Icon name="Filter" className="size-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="grid size-5 place-items-center rounded-full bg-teal text-xs text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto p-5">
                <SheetTitle className="sr-only">Filters</SheetTitle>
                {rail}
              </SheetContent>
            </Sheet>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-10 w-[150px]" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results meta */}
        <div className="mt-5 flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground">
            {results.length} {results.length === 1 ? "tool" : "tools"}
            {query.trim() && (
              <span className="text-muted-foreground/70">
                {" "}
                for “{query.trim()}”
              </span>
            )}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-teal hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Grid / empty state */}
        {results.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((tool, i) => (
              <Reveal key={tool.slug} index={Math.min(i, 6)}>
                <SavableToolCard
                  tool={tool}
                  categoryName={categoryName.get(tool.categorySlug)}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <span
              className="emblem size-12 opacity-40"
              style={{ color: "var(--brand-teal)" }}
              aria-hidden
            />
            <div>
              <p className="font-display text-lg font-semibold">
                No tools match your filters
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try loosening a filter or clearing your search.
              </p>
            </div>
            <Button variant="outline" onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- filter rail */

type RailProps = {
  categories: CategoryWithCount[];
  tags: string[];
  category: string;
  setCategory: (c: string) => void;
  pricing: PricingModel[];
  togglePricing: (m: PricingModel) => void;
  minRating: number;
  setMinRating: (r: number) => void;
  selectedTags: string[];
  toggleTag: (t: string) => void;
  activeFilterCount: number;
  clearAll: () => void;
};

function FilterRail({
  categories,
  tags,
  category,
  setCategory,
  pricing,
  togglePricing,
  minRating,
  setMinRating,
  selectedTags,
  toggleTag,
  activeFilterCount,
  clearAll,
}: RailProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Filters
        </h2>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-teal hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Category */}
      <FilterGroup label="Category">
        <div className="flex flex-col gap-0.5">
          <RailOption
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All categories"
          />
          {categories.map((c) => (
            <RailOption
              key={c.slug}
              active={category === c.slug}
              onClick={() => setCategory(c.slug)}
              label={c.name}
              count={c.toolCount}
            />
          ))}
        </div>
      </FilterGroup>

      {/* Pricing */}
      <FilterGroup label="Pricing">
        <div className="flex flex-wrap gap-2">
          {PRICING_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={pricing.includes(opt.value)}
              onClick={() => togglePricing(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      {/* Rating */}
      <FilterGroup label="Minimum rating">
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={minRating === opt.value}
              onClick={() => setMinRating(opt.value)}
            >
              {opt.value > 0 && (
                <Icon name="Star" className="size-3 text-teal" />
              )}
              {opt.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      {/* Tags */}
      <FilterGroup label="Popular tags">
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 16).map((tag) => (
            <Chip
              key={tag}
              active={selectedTags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function RailOption({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-teal/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        {active && (
          <span className="size-1.5 rounded-full bg-teal" aria-hidden />
        )}
        {label}
      </span>
      {count !== undefined && (
        <span className="font-mono text-xs text-muted-foreground/70 tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-teal/50 bg-teal/10 text-foreground"
          : "border-border text-muted-foreground hover:border-teal/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}
