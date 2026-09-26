import { cn } from "@/lib/utils";

/**
 * The founder takeaway on a card: Enki's own analysis, set apart from the
 * reporting so readers meet it first. Renders nothing for stories without one.
 */
export function FounderTakeaway({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return (
    <p className={cn("border-l-2 border-teal/60 pl-3 text-sm leading-relaxed text-pretty text-foreground/85", className)}>
      <span className="font-semibold text-teal-bright">For founders: </span>
      {text}
    </p>
  );
}
