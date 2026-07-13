import type { ReviewWithAuthor } from "@/lib/content";
import { StarRating } from "@/components/shared/star-rating";
import { Monogram } from "@/components/shared/monogram";
import { Icon } from "@/components/shared/icon";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReviewList({ reviews }: { reviews: ReviewWithAuthor[] }) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        No written reviews yet — be the first to share your experience.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-2xl border border-border bg-card p-5 ring-hairline"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Monogram
                name={review.author?.name ?? "Anonymous"}
                accent={review.author?.accent ?? "#00ADB5"}
                size="sm"
              />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {review.author?.name ?? "Anonymous"}
                  {review.verified && (
                    <span
                      className="inline-flex items-center gap-0.5 text-teal"
                      title="Verified reviewer"
                    >
                      <Icon name="BadgeCheck" className="size-3.5" />
                    </span>
                  )}
                </p>
                <p className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                  {review.author?.role ?? "Community"} ·{" "}
                  {formatDate(review.date)}
                </p>
              </div>
            </div>
            <StarRating value={review.rating} size={13} />
          </div>

          <h4 className="mt-4 font-display text-base font-semibold">
            {review.title}
          </h4>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            {review.body}
          </p>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="ThumbsUp" className="size-3.5" />
            {review.helpful} found this helpful
          </div>
        </li>
      ))}
    </ul>
  );
}
