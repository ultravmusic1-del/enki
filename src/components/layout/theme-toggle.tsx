"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/icon";

/**
 * Dark/light toggle. The icon is chosen with CSS `dark:` variants rather than
 * client state, so there's no hydration mismatch and no setState-in-effect —
 * the correct glyph shows as soon as next-themes stamps the html class.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      className="rounded-full text-muted-foreground hover:text-foreground"
      onClick={() =>
        setTheme(
          document.documentElement.classList.contains("dark")
            ? "light"
            : "dark",
        )
      }
    >
      <Icon name="Sun" className="hidden size-4 dark:block" />
      <Icon name="Moon" className="size-4 dark:hidden" />
    </Button>
  );
}
