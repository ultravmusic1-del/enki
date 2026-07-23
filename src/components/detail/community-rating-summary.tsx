import { StarRating } from "@/components/shared/star-rating";

/**
 * The real community rating for a tool, derived from moderated Supabase
 * reviews (not the seeded editorial sample figures). Renders nothing until at
 * least one review exists, so tools with no submissions stay unchanged.
 */
export function CommunityRatingSummary({
  average,
  count,
}: {
  average: number;
  count: number;
}) {
  if (count === 0) return null;

  return (
    <div className="ring-hairline flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-teal/20 bg-teal/[0.06] px-4 py-3">
      <span className="font-mono text-xs tracking-wide text-teal uppercase">
        Community rating
      </span>
      <span className="flex items-center gap-2">
        <StarRating value={average} size={15} />
        <span className="font-mono text-sm tabular-nums">
          {average.toFixed(1)}
        </span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {`from ${count} ${count === 1 ? "review" : "reviews"}`}
      </span>
    </div>
  );
}
