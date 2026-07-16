"use client";

import type { Tool } from "@/lib/schemas";
import { ToolCard } from "@/components/shared/tool-card";
import { SaveButton } from "@/components/saved/save-button";
import { cn } from "@/lib/utils";

/**
 * A ToolCard with a floating save control at its corner. Keeps ToolCard itself
 * a plain full-card link (no nested interactive elements) — the save button is
 * a sibling layered above it. Reveals on hover/focus by default; pass
 * `alwaysShow` for management views (the saved list) where it's always actionable.
 */
export function SavableToolCard({
  tool,
  categoryName,
  alwaysShow = false,
  className,
}: {
  tool: Tool;
  categoryName?: string;
  alwaysShow?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("group/save relative h-full", className)}>
      <SaveButton
        slug={tool.slug}
        name={tool.name}
        variant="icon"
        className={cn(
          "absolute -top-2.5 -right-2.5 z-10 shadow-md transition-opacity duration-200",
          alwaysShow
            ? "opacity-100"
            : "opacity-0 group-hover/save:opacity-100 group-focus-within/save:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      />
      <ToolCard tool={tool} categoryName={categoryName} className="h-full" />
    </div>
  );
}
