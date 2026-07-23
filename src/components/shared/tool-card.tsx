import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tool } from "@/lib/schemas";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
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
 *
 * Layout note: the name gets the full top-row width beside the logo, and the
 * pricing badge lives in the bottom meta row. In a narrow 3-up card the name
 * and badge can't share a row without one clipping or the other truncating, so
 * they're deliberately kept on separate rows — both stay fully legible.
 */
export function ToolCard({ tool, categoryName, className }: ToolCardProps) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={cn(
        "group/card relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5",
        "transition-all duration-300 ring-hairline",
        "hover:-translate-y-1 hover:border-teal/40 hover:shadow-glow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tool.sponsored && "border-teal/30 ring-1 ring-teal/15",
        className,
      )}
    >
      {tool.featured && <BorderBeam />}

      {/* Identity — name gets the full width beside the logo */}
      <div className="flex items-center gap-3">
        <ToolLogo
          name={tool.name}
          accent={tool.accent}
          logo={tool.logo}
          size="md"
        />
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-lg leading-tight font-semibold">
            {tool.name}
          </h3>
          {categoryName && (
            <span className="block truncate font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
              {categoryName}
            </span>
          )}
          {tool.sponsored && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-teal uppercase">
              Promoted
            </span>
          )}
        </div>
      </div>

      <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
        {tool.tagline}
      </p>

      {/* Meta — rating on the left, pricing badge on the right */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-2">
          <StarRating value={tool.rating} size={14} />
          <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {tool.rating.toFixed(1)}
          </span>
        </div>
        <PricingBadge model={tool.pricing.model} className="shrink-0" />
      </div>
    </Link>
  );
}
