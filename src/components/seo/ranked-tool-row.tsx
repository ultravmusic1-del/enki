import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";

/**
 * A numbered entry in a "best of" / "alternatives" listicle. Server-rendered,
 * link-first for SEO. `note` is a one-line, deterministic reason.
 */
export function RankedToolRow({
  rank,
  tool,
  note,
}: {
  rank: number;
  tool: Tool;
  note: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-5 ring-hairline">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal/10 font-display text-sm font-semibold text-teal ring-1 ring-teal/20">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ToolLogo
              name={tool.name}
              accent={tool.accent}
              logo={tool.logo}
              size="sm"
            />
            <div className="min-w-0">
              <Link
                href={`/tools/${tool.slug}`}
                className="font-display text-lg font-semibold hover:text-teal"
              >
                {tool.name}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {tool.tagline}
              </p>
            </div>
          </div>
          <PricingBadge model={tool.pricing.model} className="shrink-0" />
        </div>
        <p className="text-sm text-pretty text-muted-foreground">{note}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <StarRating value={tool.rating} size={13} />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {tool.rating.toFixed(1)}
            </span>
          </span>
          <Link
            href={`/tools/${tool.slug}`}
            className="inline-flex items-center gap-1 font-mono text-xs text-teal hover:underline"
          >
            Read review
            <Icon name="ArrowRight" className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
