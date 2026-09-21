"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { beats } from "@/data/beats";
import { Icon } from "@/components/shared/icon";
import { activeBeatFor } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "latest", name: "Latest", href: "/news" },
  ...beats.map((beat) => ({ key: beat.slug, name: beat.name, href: `/news/beat/${beat.slug}` })),
];

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors";

/**
 * The news beat row (spec §7.1). A client component only for usePathname,
 * which renders identically on the server and client. It scrolls sideways on
 * narrow screens, so it is exempt from the visual sweep's clipping check.
 */
export function BeatRow({ className }: { className?: string }) {
  const active = activeBeatFor(usePathname());
  return (
    <nav aria-label="News beats" data-sweep-ignore className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {ITEMS.map((item) => {
          const current = active === item.key;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  pill,
                  current
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
                )}
              >
                {item.name}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/tools"
            className={cn(pill, "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Directory
            <Icon name="ArrowRight" className="size-3" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
