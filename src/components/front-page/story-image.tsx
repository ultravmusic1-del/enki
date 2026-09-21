import { cn } from "@/lib/utils";

/**
 * A hotlinked feed image over a gradient. Decorative (alt=""): a failed load
 * leaves the gradient showing, never a broken-image icon, and needs no client
 * JavaScript (plan deviation 3). next/image is not used because feed images
 * come from arbitrary publisher hosts.
 *
 * `priority` is for the lead image only: it is above the fold and the page's
 * largest paint, so lazy-loading it delays the very thing readers see first.
 */
export function StoryImage({
  src,
  className,
  priority = false,
}: {
  src: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-teal/20 to-card", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
