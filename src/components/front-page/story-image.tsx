import { cn } from "@/lib/utils";

/**
 * A hotlinked feed image over a gradient. Decorative (alt=""): a failed load
 * leaves the gradient showing, never a broken-image icon, and needs no client
 * JavaScript (plan deviation 3). next/image is not used because feed images
 * come from arbitrary publisher hosts.
 */
export function StoryImage({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-teal/20 to-card", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
