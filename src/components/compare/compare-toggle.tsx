"use client";

import { toast } from "sonner";
import { Icon } from "@/components/shared/icon";
import { useCompareSelection } from "@/components/compare/compare-selection";
import { cn } from "@/lib/utils";

/**
 * Adds/removes a tool from the compare tray. Guards the tray's four-tool cap
 * with a toast rather than silently no-op'ing.
 */
export function CompareToggle({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const { has, toggle, full, max } = useCompareSelection();
  const selected = has(slug);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected && full) {
      toast(`You can compare up to ${max} tools`, {
        description: "Remove one from the tray to add another.",
      });
      return;
    }
    toggle(slug);
    toast(selected ? `Removed ${name} from compare` : `Added ${name} to compare`);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={selected ? `Remove ${name} from compare` : `Add ${name} to compare`}
      className={cn(
        "group inline-flex h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98]",
        selected
          ? "border-teal/40 bg-teal/10 text-teal-bright"
          : "border-border text-foreground hover:border-teal/40 hover:bg-card",
        className,
      )}
    >
      <Icon
        name={selected ? "Check" : "Scale"}
        className="size-4 transition-transform group-active:scale-90"
      />
      {selected ? "In compare" : "Compare"}
    </button>
  );
}
