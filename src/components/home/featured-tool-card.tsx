import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";

/**
 * Featured tool card — the 3D "shape system" showcase used only on the home
 * page. Layered glass plane with a scooped corner, depth-stacked discs holding
 * the tool monogram, and a hover tilt. Retinted to each tool's accent.
 */
export function FeaturedToolCard({
  tool,
  categoryName,
}: {
  tool: Tool;
  categoryName?: string;
}) {
  const initial = tool.name.trim().charAt(0).toUpperCase();
  const a = tool.accent;

  return (
    <Link href={`/tools/${tool.slug}`} className="dim group">
      <div className="dim__card">
        <span className="dim__glass" aria-hidden />

        {/* Logo chip with a depth-stacked accent halo behind it */}
        <span className="dim__orbit" aria-hidden>
          <span
            className="dim__disc dim__disc--1"
            style={{
              background: `color-mix(in oklab, ${a} 26%, transparent)`,
              boxShadow: `-8px 14px 30px rgb(0 0 0 / 0.32), 0 0 34px -6px ${a}66, inset 0 0 0 1px color-mix(in oklab, ${a} 40%, transparent)`,
            }}
          />
          <span
            className="dim__disc dim__disc--2"
            style={{
              background: `color-mix(in oklab, ${a} 34%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${a} 50%, transparent)`,
            }}
          />
          <span
            className="dim__logo"
            style={
              tool.logo
                ? { background: "#fff" }
                : {
                    background: `color-mix(in oklab, ${a} 30%, transparent)`,
                  }
            }
          >
            {tool.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.logo} alt="" />
            ) : (
              <span
                className="font-display text-2xl font-semibold"
                style={{ color: a, textShadow: `0 0 16px ${a}88` }}
              >
                {initial}
              </span>
            )}
          </span>
        </span>

        {/* Content */}
        <div className="dim__content flex flex-col p-5">
          {categoryName && (
            <span className="pr-28 font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
              {categoryName}
            </span>
          )}

          <div className="mt-[62px]">
            <h3 className="pr-4 font-display text-lg leading-tight font-semibold">
              {tool.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 pr-4 text-sm text-pretty text-muted-foreground">
              {tool.tagline}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-6">
            <div className="flex items-center gap-2">
              <StarRating value={tool.rating} size={14} />
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {tool.rating.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PricingBadge model={tool.pricing.model} />
              <span className="inline-flex items-center gap-1 text-xs text-teal opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                View
                <Icon name="ArrowRight" className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
