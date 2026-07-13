import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CategoryWithCount } from "@/lib/content";
import { Icon } from "@/components/shared/icon";

/**
 * A category "tablet" — glowing icon, name, tagline, and tool count. Uses the
 * category's stored accent for its emblem tint and hover glow.
 */
export function CategoryCard({
  category,
  className,
}: {
  category: CategoryWithCount;
  className?: string;
}) {
  const { accent } = category;

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group/cat relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5",
        "transition-all duration-300 ring-hairline hover:-translate-y-1 hover:border-teal/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover/cat:opacity-100"
        style={{ background: `radial-gradient(closest-side, ${accent}55, transparent)` }}
      />

      <div className="flex items-center justify-between">
        <span
          className="grid size-11 place-items-center rounded-xl ring-hairline"
          style={{
            color: accent,
            background: `linear-gradient(150deg, ${accent}22, transparent)`,
            boxShadow: `inset 0 0 0 1px ${accent}2a`,
          }}
        >
          <Icon name={category.icon} className="size-5" />
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {category.toolCount} {category.toolCount === 1 ? "tool" : "tools"}
        </span>
      </div>

      <div>
        <h3 className="font-display text-lg leading-tight font-semibold">
          {category.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-pretty text-muted-foreground">
          {category.tagline}
        </p>
      </div>

      <span
        aria-hidden
        className="mt-1 inline-flex items-center gap-1 text-xs text-teal opacity-0 transition-all duration-300 group-hover/cat:opacity-100"
      >
        Explore
        <Icon name="ArrowRight" className="size-3.5" />
      </span>
    </Link>
  );
}
