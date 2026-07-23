"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StarRating } from "@/components/shared/star-rating";
import { CommunityRatingSummary } from "@/components/detail/community-rating-summary";
import { summarizeReviews } from "@/lib/reviews";

export const REVIEWS_UPDATED_EVENT = "enki:reviews-updated";

type Row = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  user_id: string;
  display_name: string;
};

/**
 * Real, user-submitted reviews from Supabase, shown above the seeded sample
 * reviews. Refetches whenever a review is posted (via a window event) so a new
 * review appears immediately without a full navigation.
 */
export function CommunityReviews({ toolSlug }: { toolSlug: string }) {
  const [reviews, setReviews] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: revs } = await supabase
      .from("reviews")
      .select("id, rating, title, body, created_at, user_id")
      .eq("tool_slug", toolSlug)
      .order("created_at", { ascending: false });

    if (!revs || revs.length === 0) {
      setReviews([]);
      setLoaded(true);
      return;
    }

    // No FK between reviews and profiles (both reference auth.users), so resolve
    // display names in a second query and merge.
    const ids = [...new Set(revs.map((r) => r.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));

    setReviews(
      revs.map((r) => ({
        ...r,
        display_name: nameById.get(r.user_id) ?? "Anonymous",
      })),
    );
    setLoaded(true);
  }, [toolSlug]);

  useEffect(() => {
    // Async data fetch: setState resolves after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { toolSlug?: string } | null;
      if (!detail || detail.toolSlug === toolSlug) void load();
    };
    window.addEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
  }, [load, toolSlug]);

  // Real aggregate from the moderated reviews we just fetched (RLS already
  // limits non-admins to approved rows), computed before any early return.
  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  if (!loaded || reviews.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <p className="font-mono text-xs tracking-wide text-teal uppercase">
        From the Enki community
      </p>
      <CommunityRatingSummary {...summary} />
      {reviews.map((r) => (
        <div
          key={r.id}
          className="ring-hairline rounded-2xl border border-teal/20 bg-teal/[0.04] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-teal/15 font-display text-xs font-semibold text-teal-bright">
                {r.display_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium">{r.display_name}</span>
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <StarRating value={r.rating} size={13} />
          </div>
          {r.title && (
            <p className="mt-2 font-display text-base leading-tight font-semibold">
              {r.title}
            </p>
          )}
          {r.body && (
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              {r.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
