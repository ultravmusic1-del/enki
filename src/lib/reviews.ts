/* =========================================================================
   Community review aggregation.

   The `rating` / `reviewCount` stored on a tool are seeded editorial sample
   data. These helpers derive the *real* aggregate from moderated community
   reviews in Supabase so the number shown to users reflects actual submissions.
   Pure and deterministic — the fetching lives in the component.
   ========================================================================= */

export type ReviewLike = { rating: number };

export type ReviewSummary = {
  /** Mean rating rounded to one decimal; 0 when there are no reviews. */
  average: number;
  count: number;
};

/** Aggregate a set of community reviews into a displayable summary. */
export function summarizeReviews(reviews: ReviewLike[]): ReviewSummary {
  const count = reviews.length;
  if (count === 0) return { average: 0, count: 0 };

  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: Math.round((total / count) * 10) / 10, count };
}
