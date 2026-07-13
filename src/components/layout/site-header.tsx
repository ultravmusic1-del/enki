"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import { useCommandMenu } from "@/components/layout/command-menu";

export function SiteHeader() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const linkEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const hasPlaced = useRef(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pill, setPill] = useState({ x: 0, w: 0, show: false, instant: true });

  const isActive = useCallback(
    (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  const activeIndex = siteConfig.nav.findIndex((item) => isActive(item.href));

  // Position the springy pill behind the hovered (or active) nav item.
  const placePill = useCallback((index: number, instant: boolean) => {
    const el = index >= 0 ? linkEls.current[index] : null;
    if (!el) {
      setPill((p) => ({ ...p, show: false }));
      return;
    }
    setPill({ x: el.offsetLeft, w: el.offsetWidth, show: true, instant });
  }, []);

  useLayoutEffect(() => {
    const target = hoverIndex !== null ? hoverIndex : activeIndex;
    placePill(target, !hasPlaced.current);
    hasPlaced.current = true;

    const onResize = () =>
      placePill(hoverIndex !== null ? hoverIndex : activeIndex, true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hoverIndex, activeIndex, placePill]);

  // Re-measure once webfonts settle (label widths can shift on swap).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) placePill(activeIndex, true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed the cursor-following glare its position via CSS variables.
  const onNavMouseMove = useCallback((e: React.MouseEvent) => {
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    nav.style.setProperty("--glare-x", `${e.clientX - rect.left}px`);
    nav.style.setProperty("--glare-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
      <nav
        ref={navRef}
        aria-label="Primary"
        onMouseMove={onNavMouseMove}
        className="liquid-nav flex w-full max-w-4xl items-center gap-2 rounded-full px-2 py-2"
      >
        <span className="liquid-glare" aria-hidden />

        {/* Brand */}
        <Link
          href="/"
          className="relative z-10 ml-1 flex items-center gap-2 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div
          className="relative z-10 mx-auto hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Sliding liquid pill */}
          <span
            aria-hidden
            className="nav-pill"
            data-instant={pill.instant}
            style={{
              width: pill.w,
              transform: `translate(${pill.x}px, -50%)`,
              opacity: pill.show ? 1 : 0,
            }}
          />

          {siteConfig.nav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                linkEls.current[i] = el;
              }}
              onMouseEnter={() => setHoverIndex(i)}
              className={cn(
                "relative z-10 flex h-8 items-center rounded-full px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="relative z-10 ml-auto flex items-center gap-1 md:ml-0">
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
