import { cn } from "@/lib/utils";

/**
 * A hotlinked feed image over a gradient. Decorative (alt=""): a failed load
 * leaves the gradient showing, never a broken-image icon, and needs no client
 * JavaScript (plan deviation 3). next/image is not used because feed images
 * come from arbitrary publisher hosts.
 *
 * The frame is 16:9 by default, so a layout can never stretch an image to a
 * neighbour's height (that turned the lead photo into a 225x574 sliver on
 * /news). The crop anchors a little above centre, where subjects usually sit.
 * With no image, a designed placeholder keeps rows aligned.
 *
 * `priority` is for the lead image only: it is above the fold and the page's
 * largest paint, so lazy-loading it delays the very thing readers see first.
 */
export function StoryImage({
  src,
  label,
  className,
  priority = false,
}: {
  src: string | null;
  /** Shown on the placeholder when there is no image, e.g. the beat name. */
  label?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-teal/20 to-card", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover object-[50%_35%]"
        />
      ) : (
        <div data-story-image-placeholder aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_45%,#000_20%,transparent_80%)]" />
          <div className="absolute top-1/2 left-1/2 size-[28%] max-w-24 -translate-x-1/2 -translate-y-1/2 bg-teal/45 [mask-image:url(/brand/logo-mask.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]" />
          {label ? (
            <span className="absolute bottom-3 left-3 font-mono text-[0.65rem] tracking-[0.16em] text-teal-bright/80 uppercase">
              {label}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
