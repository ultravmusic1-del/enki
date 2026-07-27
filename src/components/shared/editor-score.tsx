import { cn } from "@/lib/utils";

/**
 * Enki's editorial score, 0-10.
 *
 * This replaces the star rating that used to sit here. That rating was an
 * editorial sample figure displayed as a community average, next to a review
 * count no user had contributed to. This says exactly what it is: one editor's
 * judgement, labelled as such.
 */
export function EditorScore({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 tabular-nums",
        className,
      )}
    >
      <span
        className={cn(
          "font-display font-semibold text-foreground",
          size === "md" ? "text-lg" : "text-sm",
        )}
      >
        {value.toFixed(1)}
      </span>
      <span className="font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
        Editor&rsquo;s score
      </span>
    </span>
  );
}
