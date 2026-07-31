"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut badge that tells the truth on the visitor's platform.
 *
 * The command-menu handler has always accepted `metaKey || ctrlKey`, but the
 * badge was hard-coded to the Mac glyph, so most visitors were shown a key
 * their keyboard does not have.
 *
 * Renders the Ctrl form during SSR and the first client pass, then corrects on
 * a Mac after mount: `navigator.platform` does not exist on the server, and
 * branching on it during render would be a hydration mismatch.
 */
export function ShortcutHint({
  keyName,
  className,
}: {
  keyName: string;
  className?: string;
}) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // navigator.platform has no server-side equivalent, so this genuinely
    // cannot be derived during render (would be a hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(window.navigator.platform));
  }, []);

  const label = isMac ? `⌘${keyName}` : `Ctrl ${keyName}`;

  return (
    <kbd
      aria-label={`Keyboard shortcut: ${isMac ? "Command" : "Control"} ${keyName}`}
      className={cn(
        // group-hover:text-foreground keeps the hero badge brightening in
        // step with the button's icon and label on hover (the button
        // declares `group`, and the original hero <kbd> had no color class
        // of its own, so it inherited that hover brightening). On the
        // header, the parent <Button> has no `group` class, so this utility
        // compiles but never matches, leaving that badge's static color.
        "pointer-events-none rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted-foreground group-hover:text-foreground",
        className,
      )}
    >
      {label}
    </kbd>
  );
}
