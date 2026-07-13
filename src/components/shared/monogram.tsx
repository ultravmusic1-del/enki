import { cn } from "@/lib/utils";

type MonogramProps = {
  /** Tool or brand name — first letter becomes the monogram. */
  name: string;
  /** Per-entity accent hex from seed data. */
  accent: string;
  className?: string;
  /** Tailwind size classes are applied via className; this sizes the glyph. */
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "size-9 text-base rounded-lg",
  md: "size-12 text-xl rounded-xl",
  lg: "size-16 text-3xl rounded-2xl",
} as const;

/**
 * Branded monogram "tile" standing in for a tool logo. Uses the tool's stored
 * accent for a subtle tinted-glass look with a glowing initial.
 */
export function Monogram({
  name,
  accent,
  className,
  size = "md",
}: MonogramProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden font-display font-semibold ring-hairline",
        sizeMap[size],
        className,
      )}
      style={{
        color: accent,
        backgroundImage: `linear-gradient(150deg, ${accent}22, ${accent}0a 55%, transparent), radial-gradient(120% 120% at 20% 0%, ${accent}33, transparent 60%)`,
        boxShadow: `inset 0 0 0 1px ${accent}33, 0 0 22px -12px ${accent}`,
      }}
      aria-hidden
    >
      <span
        className="drop-shadow-[0_0_8px_currentColor]"
        style={{ textShadow: `0 0 14px ${accent}66` }}
      >
        {initial}
      </span>
    </span>
  );
}
