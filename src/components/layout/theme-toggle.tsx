"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/icon";

/** Dark/light toggle. Renders a stable placeholder until mounted to avoid
 *  hydration mismatch (theme is only known client-side). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      className="rounded-full text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        <Icon
          name={isDark ? "Sun" : "Moon"}
          className="size-4 transition-transform"
        />
      ) : (
        <span className="size-4" />
      )}
    </Button>
  );
}
