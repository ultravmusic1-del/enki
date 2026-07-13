"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { Tool } from "@/lib/schemas";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";

type Screenshot = Tool["screenshots"][number];

/**
 * Embla screenshot carousel. Real product screenshots don't exist for seeded
 * tools, so each "screen" is a generated gradient built from its stored hue,
 * dressed with faux browser chrome and a caption.
 */
export function ScreenshotCarousel({
  screenshots,
  accent,
}: {
  screenshots: Screenshot[];
  accent: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" }, [
    Autoplay({ delay: 4800, stopOnInteraction: true, stopOnMouseEnter: true }),
  ]);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = (i: number) => emblaApi?.scrollTo(i);
  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-border ring-hairline">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {screenshots.map((shot, i) => (
              <div key={i} className="min-w-0 flex-[0_0_100%]">
                <Screen shot={shot} />
              </div>
            ))}
          </div>
        </div>

        {screenshots.length > 1 && (
          <>
            <CarouselButton
              side="left"
              onClick={scrollPrev}
              label="Previous screenshot"
            />
            <CarouselButton
              side="right"
              onClick={scrollNext}
              label="Next screenshot"
            />
          </>
        )}

        {/* Caption */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
          <p className="font-mono text-[0.7rem] tracking-wide text-white/60 uppercase">
            {screenshots[selected]?.title}
          </p>
          <p className="text-sm text-white/90">
            {screenshots[selected]?.caption}
          </p>
        </div>
      </div>

      {/* Dots */}
      {screenshots.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {screenshots.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to screenshot ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                selected === i
                  ? "w-6 bg-teal"
                  : "w-1.5 bg-border hover:bg-muted-foreground",
              )}
              style={selected === i ? { backgroundColor: accent } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Screen({ shot }: { shot: Screenshot }) {
  const { hue } = shot;
  return (
    <div
      className="relative aspect-[16/10] w-full"
      style={{
        backgroundImage: `
          radial-gradient(120% 120% at 15% 0%, hsl(${hue} 70% 22% / 0.9), transparent 55%),
          radial-gradient(100% 100% at 100% 100%, hsl(${(hue + 40) % 360} 65% 30% / 0.75), transparent 60%),
          linear-gradient(160deg, hsl(${hue} 45% 10%), hsl(${hue} 40% 6%))`,
      }}
    >
      {/* faux window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 h-4 w-40 rounded-full bg-white/10" />
      </div>

      {/* faux content skeleton */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="grid size-16 place-items-center rounded-2xl"
          style={{
            background: `hsl(${hue} 70% 55% / 0.18)`,
            boxShadow: `0 0 40px hsl(${hue} 80% 60% / 0.4)`,
          }}
        >
          <span
            className="emblem size-9"
            style={{ color: `hsl(${hue} 80% 70%)` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="absolute right-6 bottom-16 left-6 flex flex-col gap-2 opacity-60">
        <span className="h-2 w-1/2 rounded-full bg-white/15" />
        <span className="h-2 w-2/3 rounded-full bg-white/10" />
        <span className="h-2 w-1/3 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

function CarouselButton({
  side,
  onClick,
  label,
}: {
  side: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full glass border border-border text-foreground transition-colors hover:border-teal/40",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon
        name={side === "left" ? "ArrowLeft" : "ArrowRight"}
        className="size-4"
      />
    </button>
  );
}
