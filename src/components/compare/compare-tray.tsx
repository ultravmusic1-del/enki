"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToolLogo } from "@/components/shared/tool-logo";
import { Icon } from "@/components/shared/icon";
import { useCompareSelection } from "@/components/compare/compare-selection";
import { cn } from "@/lib/utils";

export type CompareTrayTool = {
  slug: string;
  name: string;
  logo?: string;
  accent: string;
};

/**
 * A persistent tray that collects tools to compare from anywhere in the app,
 * then hands off to the URL-driven /compare page. Always mounted so it can
 * slide in/out smoothly; hidden (and click-through) when empty or when the
 * user is already on the compare page.
 */
export function CompareTray({ tools }: { tools: CompareTrayTool[] }) {
  const { slugs, count, clear, remove, max } = useCompareSelection();
  const router = useRouter();
  const pathname = usePathname();

  const bySlug = useMemo(
    () => new Map(tools.map((t) => [t.slug, t])),
    [tools],
  );
  const chosen = slugs
    .map((s) => bySlug.get(s))
    .filter((t): t is CompareTrayTool => Boolean(t));

  const visible = count > 0 && pathname !== "/compare";
  const canCompare = count >= 2;

  const goCompare = () => {
    router.push(`/compare?tools=${slugs.join(",")}`);
  };

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-[160%] opacity-0",
      )}
    >
      <div
        role="region"
        aria-label="Compare tray"
        className="glass ring-hairline flex w-full max-w-2xl items-center gap-3 rounded-full border border-border py-2.5 pr-2.5 pl-4 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.7)]"
      >
        <span className="hidden shrink-0 font-mono text-xs tracking-wide text-muted-foreground uppercase sm:inline">
          Compare
        </span>

        {/* Selected tool chips */}
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {chosen.map((t) => (
            <li key={t.slug} className="shrink-0">
              <button
                type="button"
                onClick={() => remove(t.slug)}
                aria-label={`Remove ${t.name} from compare`}
                title={`Remove ${t.name}`}
                className="group relative"
              >
                <ToolLogo
                  name={t.name}
                  accent={t.accent}
                  logo={t.logo}
                  size="sm"
                  className="size-9 transition-opacity group-hover:opacity-40"
                />
                <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon name="X" className="size-4 text-foreground" />
                </span>
              </button>
            </li>
          ))}
          {/* Empty slots hint remaining capacity */}
          {Array.from({ length: Math.max(0, max - count) }).map((_, i) => (
            <li
              key={`slot-${i}`}
              aria-hidden
              className="size-9 shrink-0 rounded-lg border border-dashed border-border/70"
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={clear}
          aria-label="Clear compare tray"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon name="X" className="size-4" />
        </button>

        <button
          type="button"
          onClick={goCompare}
          disabled={!canCompare}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-all",
            canCompare
              ? "bg-teal text-[#04171a] shadow-glow-sm hover:-translate-y-px hover:bg-teal-bright"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {canCompare ? (
            <>
              Compare {count}
              <Icon name="ArrowRight" className="size-4" />
            </>
          ) : (
            "Add one more"
          )}
        </button>
      </div>
    </div>
  );
}
