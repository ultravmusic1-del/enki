"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icon } from "@/components/shared/icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useCommandMenu } from "@/components/layout/command-menu";

export function SiteHeader() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
      <nav
        aria-label="Primary"
        className={cn(
          "flex w-full max-w-4xl items-center gap-2 rounded-full border px-2 py-2 transition-all duration-300",
          scrolled
            ? "glass border-border/80 shadow-lg shadow-black/20"
            : "border-transparent bg-transparent",
        )}
      >
        {/* Brand */}
        <Link
          href="/"
          className="ml-1 flex items-center gap-2 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="emblem size-6"
            style={{ color: "var(--brand-teal)" }}
            aria-hidden
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            Enki
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="hidden gap-2 rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <Icon name="Search" className="size-4" />
            <kbd className="pointer-events-none rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="rounded-full text-muted-foreground hover:text-foreground sm:hidden"
          >
            <Icon name="Search" className="size-4" />
          </Button>

          <ThemeToggle />

          <button
            type="button"
            onClick={() =>
              toast("Accounts are coming soon", {
                description: "Enki is in preview — browsing is fully open.",
              })
            }
            className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
          >
            Log In
          </button>

          <Link
            href="/tools"
            className="hidden items-center gap-1.5 rounded-full bg-mist px-4 py-1.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow-sm sm:inline-flex"
          >
            Explore
            <Icon name="ArrowRight" className="size-3.5" />
          </Link>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open menu"
                className="rounded-full md:hidden"
              >
                <Icon name="Menu" className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <span
                  className="emblem size-6"
                  style={{ color: "var(--brand-teal)" }}
                  aria-hidden
                />
                <span className="font-display text-lg font-semibold">Enki</span>
              </div>
              <div className="flex flex-col p-3">
                {siteConfig.nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      isActive(item.href) && "text-foreground",
                    )}
                  >
                    {item.title}
                  </Link>
                ))}
                <Link
                  href="/tools"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-mist px-4 py-2.5 text-sm font-medium text-[#16191d]"
                >
                  Explore tools
                  <Icon name="ArrowRight" className="size-3.5" />
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
