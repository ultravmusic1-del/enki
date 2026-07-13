import Link from "next/link";
import type { CategoryWithCount } from "@/lib/content";
import { Icon } from "@/components/shared/icon";

/**
 * Category tile — the 3D shape system in its faceted "crystal" variant, used
 * only on the home page. Depth-stacked discs hold the category's lucide icon,
 * tinted with the category accent.
 */
export function CategoryTile({ category }: { category: CategoryWithCount }) {
  const a = category.accent;

  return (
    <Link
      href={`/categories/${category.slug}`}
      className="dim dim--compact group"
    >
      <div className="dim__card">
        <span className="dim__glass dim__glass--facet" aria-hidden />

        {/* Depth-stacked icon orbit */}
        <span className="dim__orbit" aria-hidden>
          <span
            className="dim__disc dim__disc--1"
            style={{
              background: `color-mix(in oklab, ${a} 12%, transparent)`,
              boxShadow: `-8px 12px 24px rgb(0 0 0 / 0.28), inset 0 0 0 1px color-mix(in oklab, ${a} 20%, transparent)`,
            }}
          />
          <span
            className="dim__disc dim__disc--2"
            style={{
              background: `color-mix(in oklab, ${a} 16%, transparent)`,
              boxShadow: `-6px 10px 20px rgb(0 0 0 / 0.26), inset 0 0 0 1px color-mix(in oklab, ${a} 26%, transparent)`,
            }}
          />
          <span
            className="dim__disc dim__disc--3"
            style={{
              background: `color-mix(in oklab, ${a} 26%, transparent)`,
              color: a,
              boxShadow: `-4px 8px 16px rgb(0 0 0 / 0.3), inset 0 0 0 1px color-mix(in oklab, ${a} 42%, transparent)`,
            }}
          >
            <Icon
              name={category.icon}
              className="size-[18px]"
              style={{ filter: `drop-shadow(0 0 8px ${a}88)` }}
            />
          </span>
        </span>

        {/* Content */}
        <div className="dim__content flex flex-col p-5">
          <span className="pr-24 font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            Category
          </span>

          <div className="mt-[52px]">
            <h3 className="font-display text-lg leading-tight font-semibold">
              {category.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 pr-4 text-sm text-pretty text-muted-foreground">
              {category.tagline}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between pt-6">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {category.toolCount}{" "}
              {category.toolCount === 1 ? "tool" : "tools"}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-teal opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Explore
              <Icon name="ArrowRight" className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
