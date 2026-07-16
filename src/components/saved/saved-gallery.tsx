"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tool } from "@/lib/schemas";
import { SavableToolCard } from "@/components/shared/savable-tool-card";
import { Icon } from "@/components/shared/icon";
import { useSavedTools } from "@/components/saved/saved-tools";
import {
  useCompareSelection,
  COMPARE_MAX,
} from "@/components/compare/compare-selection";
import { Skeleton } from "@/components/ui/skeleton";

export type SavedItem = { tool: Tool; categoryName: string };

export function SavedGallery({ items }: { items: SavedItem[] }) {
  const { saved, ready, count, clear } = useSavedTools();
  const { replace: setCompare } = useCompareSelection();
  const router = useRouter();
  const bySlug = useMemo(
    () => new Map(items.map((i) => [i.tool.slug, i])),
    [items],
  );

  const compareSaved = () => {
    const slugs = saved.slice(0, COMPARE_MAX);
    setCompare(slugs);
    router.push(`/compare?tools=${slugs.join(",")}`);
  };

  // Before hydration we don't yet know what's saved — hold a skeleton so the
  // layout doesn't jump between empty and populated.
  if (!ready) {
    return (
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }

  const list = saved
    .map((slug) => bySlug.get(slug))
    .filter((i): i is SavedItem => Boolean(i));

  if (list.length === 0) {
    return (
      <div className="glass ring-hairline mt-10 flex flex-col items-center rounded-2xl border border-border px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Icon name="Bookmark" className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold">
          No saved tools yet
        </h2>
        <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
          Tap the save icon on any tool to keep it here. Your shortlist lives on
          this device, ready whenever you come back.
        </p>
        <Link
          href="/tools"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-mist px-6 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow"
        >
          Browse the directory
          <Icon name="ArrowRight" className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          {count} {count === 1 ? "tool" : "tools"} saved
        </span>
        <div className="flex items-center gap-1">
          {count >= 2 && (
            <button
              type="button"
              onClick={compareSaved}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/5 px-3 py-1.5 text-sm text-teal-bright transition-colors hover:border-teal/50 hover:bg-teal/10"
            >
              <Icon name="Scale" className="size-3.5" />
              Compare
              {count > COMPARE_MAX ? ` top ${COMPARE_MAX}` : ""}
            </button>
          )}
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="X" className="size-3.5" />
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ tool, categoryName }) => (
          <SavableToolCard
            key={tool.slug}
            tool={tool}
            categoryName={categoryName}
            alwaysShow
          />
        ))}
      </div>
    </div>
  );
}
