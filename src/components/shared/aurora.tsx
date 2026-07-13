import { cn } from "@/lib/utils";

/**
 * Ambient teal aurora / flow-curve background. Enki = water & flow, so these
 * slow drifting blooms replace the inspiration's hard light-streaks. Purely
 * decorative; animation is neutralized under prefers-reduced-motion.
 */
export function Aurora({
  className,
  intensity = "medium",
}: {
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
}) {
  const opacity = { subtle: 0.4, medium: 0.65, strong: 0.9 }[intensity];

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
      style={{ opacity }}
    >
      <div
        className="absolute -top-1/3 left-1/2 h-[70vh] w-[80vw] -translate-x-1/2 animate-aurora rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--glow) / 0.35), transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/4 -left-1/4 h-[50vh] w-[55vw] animate-float rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--glow) / 0.18), transparent 70%)",
          animationDelay: "-3s",
        }}
      />
      <div
        className="absolute -right-1/4 bottom-0 h-[45vh] w-[50vw] animate-aurora rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--glow) / 0.15), transparent 70%)",
          animationDelay: "-8s",
        }}
      />
    </div>
  );
}
