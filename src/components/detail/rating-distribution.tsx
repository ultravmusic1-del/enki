"use client";

import { motion, useReducedMotion } from "motion/react";
import { StarRating } from "@/components/shared/star-rating";

type Bucket = { star: number; count: number; pct: number };

/**
 * Aggregate rating summary + 5-bucket distribution bars. Bars fill on scroll
 * into view (static under reduced motion). The distribution is synthesized
 * server-side from the aggregate; this only presents it.
 */
export function RatingDistribution({
  rating,
  reviewCount,
  distribution,
}: {
  rating: number;
  reviewCount: number;
  distribution: Bucket[];
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {/* Big score */}
      <div className="flex flex-col items-center gap-1 sm:w-40">
        <span className="font-display text-5xl font-semibold text-foreground tabular-nums">
          {rating.toFixed(1)}
        </span>
        <StarRating value={rating} size={16} />
        <span className="mt-1 font-mono text-xs text-muted-foreground">
          {reviewCount.toLocaleString()} reviews
        </span>
      </div>

      {/* Bars */}
      <div className="flex flex-1 flex-col gap-2">
        {distribution.map((bucket) => (
          <div key={bucket.star} className="flex items-center gap-3">
            <span className="flex w-8 items-center gap-1 font-mono text-xs text-muted-foreground tabular-nums">
              {bucket.star}
              <span className="text-teal">★</span>
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-teal"
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${bucket.pct}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">
              {bucket.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
