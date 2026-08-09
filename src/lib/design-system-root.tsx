import * as React from "react";

/**
 * Preview/design-tool root for the Enki design system.
 *
 * Enki is dark-only. The token values live on `:root`, but the app also keeps
 * `class="dark"` on `<html>` so Tailwind's `dark:` variant utilities resolve —
 * several primitives rely on them (Badge's destructive variant, for one). A
 * component rendered outside that class gets the tokens but silently loses
 * every `dark:` rule, and lands on a white page because nothing applies
 * `--background`.
 *
 * This wrapper restores all three: the `dark` class, the background/foreground
 * tokens, and the brand families. The font families are named directly rather
 * than via next/font's `--font-*` variables, because those are injected by a
 * build-hashed class on `<html>` that does not exist outside the Next app —
 * the `@font-face` rules themselves ship with the bundle, so the families
 * resolve.
 *
 * Wired as `cfg.provider` in .design-sync/config.json, and excluded from the
 * component list: it is scaffolding, not a primitive anyone should compose.
 */
export function DesignSystemRoot({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div
      className="dark"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        fontFamily: '"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif',
        padding: 24,
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
