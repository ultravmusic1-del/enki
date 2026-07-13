import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tool } from "@/lib/schemas";
import { Monogram } from "@/components/shared/monogram";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";
import { BorderBeam } from "@/components/shared/border-beam";

type ToolCardProps = {
  tool: Tool;
  /** Category display name (resolved by the caller). */
  categoryName?: string;
  className?: string;
};

/**
 * A tool "tablet" — the core directory card. Server-rendered; hover motion is
 * pure CSS so the card stays cheap. Featured tools get a faint teal beam.
 */
export function ToolCard({ tool, categoryName, className }: ToolCardProps) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={cn(
        "group/card relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5",
        "transition-all duration-300 ring-hairline",
        "hover:-translate-y-1 hover:border-teal/40 hover:shadow-glow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {tool.featured && <BorderBeam />}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Monogram name={tool.name} accent={tool.accent} size="md" />
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg leading-tight font-semibold">
              {tool.name}
            </h3>
            {categoryName && (
              <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                {categoryName}
              </span>
            )}
          </div>
        </div>
        <PricingBadge model={tool.pricing.model} />
      </div>

      <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
        {tool.tagline}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <StarRating value={tool.rating} size={14} />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {tool.rating.toFixed(1)}
            <span className="text-muted-foreground/60">
              {" "}
              ({tool.reviewCount.toLocaleString()})
            </span>
          </span>
        </div>
        <span
          aria-hidden
          className="inline-flex items-center gap-1 text-xs text-teal opacity-0 transition-all duration-300 group-hover/card:translate-x-0 group-hover/card:opacity-100 -translate-x-1"
        >
          View
          <Icon name="ArrowRight" className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
