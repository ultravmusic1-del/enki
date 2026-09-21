"use client";

import { useCommandMenu } from "@/components/layout/command-menu";
import { Icon } from "@/components/shared/icon";
import { ShortcutHint } from "@/components/shared/shortcut-hint";

/** Looks like a search field; opens the site-wide command menu. */
export function FindToolButton() {
  const { setOpen } = useCommandMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-background/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
    >
      <Icon name="Search" className="size-4 text-teal" />
      <span className="flex-1">Find a tool</span>
      <ShortcutHint keyName="K" />
    </button>
  );
}
