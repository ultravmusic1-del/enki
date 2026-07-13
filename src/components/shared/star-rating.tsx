import { cn } from "@/lib/utils";

type StarRatingProps = {
  /** Rating value, 0–5. Fractional values render a partial star. */
  value: number;
  /** Pixel size of each star. */
  size?: number;
  className?: string;
  /** Show the numeric value alongside the stars. */
  showValue?: boolean;
};

/**
 * Teal star rating rendered with inline SVG (no icon dependency, so fractional
 * fills are exact). The accent is the brand teal per the design language.
 */
export function StarRating({
  value,
  size = 16,
  className,
  showValue = false,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={`Rated ${clamped.toFixed(1)} out of 5`}
    >
      <span className="inline-flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i));
          return <Star key={i} fill={fill} size={size} />;
        })}
      </span>
      {showValue && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {clamped.toFixed(1)}
        </span>
      )}
    </span>
  );
}

function Star({ fill, size }: { fill: number; size: number }) {
  const id = `star-${Math.round(fill * 100)}-${size}`;
  const d =
    "M12 2.25l2.955 5.988 6.607.96-4.781 4.66 1.128 6.58L12 17.34l-5.909 3.107 1.128-6.58-4.78-4.66 6.606-.96L12 2.25z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--brand-teal)" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill={`url(#${id})`}
        stroke="var(--brand-teal)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        opacity={fill > 0 ? 1 : 0.35}
      />
    </svg>
  );
}
