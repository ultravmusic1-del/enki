"use client";

import { toast } from "sonner";
import { Icon } from "@/components/shared/icon";
import { useSavedTools } from "@/components/saved/saved-tools";
import { cn } from "@/lib/utils";

/**
 * Toggle a tool's saved state. Two shapes:
 *  - "button": a full labelled pill for detail-page action rows.
 *  - "icon": a compact round control for overlaying on cards/tiles.
 * Renders the un-saved state until the store is `ready` so SSR and the first
 * client paint agree.
 */
export function SaveButton({
  slug,
  name,
  variant = "button",
  className,
}: {
  slug: string;
  name: string;
  variant?: "button" | "icon";
  className?: string;
}) {
  const { isSaved, toggle, ready } = useSavedTools();
  const saved = ready && isSaved(slug);

  const onToggle = (e: React.MouseEvent) => {
    // Allow use inside larger clickable surfaces without triggering them.
    e.preventDefault();
    e.stopPropagation();
    const nowSaved = !isSaved(slug);
    toggle(slug);
    toast(nowSaved ? `Saved ${name}` : `Removed ${name}`, {
      description: nowSaved
        ? "Find it any time under Saved."
        : "Removed from your saved tools.",
    });
  };

  const label = saved ? `Remove ${name} from saved` : `Save ${name}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        className={cn(
          "grid size-9 place-items-center rounded-full border backdrop-blur transition-all duration-200 hover:-translate-y-px active:scale-90",
          saved
            ? "border-teal/40 bg-teal/15 text-teal-bright"
            : "border-border bg-background/70 text-muted-foreground hover:border-teal/40 hover:text-foreground",
          className,
        )}
      >
        <Icon
          name={saved ? "BookmarkCheck" : "Bookmark"}
          className={cn("size-4 transition-transform", saved && "scale-110")}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={label}
      className={cn(
        "group inline-flex h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98]",
        saved
          ? "border-teal/40 bg-teal/10 text-teal-bright"
          : "border-border text-foreground hover:border-teal/40 hover:bg-card",
        className,
      )}
    >
      <Icon
        name={saved ? "BookmarkCheck" : "Bookmark"}
        className={cn(
          "size-4 transition-transform group-active:scale-90",
          saved && "scale-110",
        )}
      />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
