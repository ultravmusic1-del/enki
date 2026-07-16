"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type FuseType from "fuse.js";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SearchDoc } from "@/lib/content";
import { Icon } from "@/components/shared/icon";
import { ToolLogo } from "@/components/shared/tool-logo";

type CommandMenuContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const Ctx = createContext<CommandMenuContext | null>(null);

// Primary destinations, surfaced as quick-nav in the palette.
const PAGES: { label: string; href: string; icon: string; keywords: string }[] =
  [
    { label: "Home", href: "/", icon: "House", keywords: "home start" },
    {
      label: "Directory",
      href: "/tools",
      icon: "LayoutGrid",
      keywords: "tools browse directory all",
    },
    {
      label: "Categories",
      href: "/categories",
      icon: "Layers",
      keywords: "categories browse groups",
    },
    {
      label: "Compare",
      href: "/compare",
      icon: "Scale",
      keywords: "compare versus vs side by side",
    },
    {
      label: "Leaderboards",
      href: "/leaderboards",
      icon: "Trophy",
      keywords: "leaderboard top ranked best rankings",
    },
    {
      label: "Saved",
      href: "/saved",
      icon: "Bookmark",
      keywords: "saved bookmarks shortlist favorites",
    },
  ];

export function useCommandMenu() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useCommandMenu must be used within CommandMenuProvider");
  }
  return ctx;
}

/**
 * ⌘K command palette. Fuse.js is dynamically imported on first open (per the
 * plan) so it never weighs down the initial load. cmdk's own filtering is
 * disabled — Fuse drives ranking for proper fuzzy search.
 */
export function CommandMenuProvider({
  docs,
  children,
}: {
  docs: SearchDoc[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [fuse, setFuse] = useState<FuseType<SearchDoc> | null>(null);

  // Reset the query whenever the palette closes (no setState-in-effect).
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setQuery("");
  }, []);
  const open = openState;

  const toggle = useCallback(() => setOpen(!openState), [openState, setOpen]);

  // Global ⌘K / Ctrl-K shortcut.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Lazy-load Fuse the first time the palette opens.
  useEffect(() => {
    if (!open || fuse) return;
    let active = true;
    void import("fuse.js").then(({ default: Fuse }) => {
      if (!active) return;
      setFuse(
        new Fuse(docs, {
          includeScore: true,
          ignoreLocation: true,
          // Match the directory's tightened relevance (see directory-explorer).
          threshold: 0.3,
          minMatchCharLength: 2,
          keys: [
            { name: "name", weight: 0.5 },
            { name: "tagline", weight: 0.2 },
            { name: "tags", weight: 0.15 },
            { name: "category", weight: 0.1 },
            { name: "description", weight: 0.05 },
          ],
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [open, docs, fuse]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return docs;
    if (fuse) {
      return fuse.search(q).map((r) => r.item);
    }
    // Fallback substring match while Fuse is still loading.
    const lower = q.toLowerCase();
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        d.tagline.toLowerCase().includes(lower) ||
        d.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }, [query, docs, fuse]);

  const tools = results.filter((d) => d.type === "tool");
  const cats = results.filter((d) => d.type === "category");

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    );
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const value = useMemo(
    () => ({ open, setOpen, toggle }),
    [open, setOpen, toggle],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Enki"
        description="Search AI tools and categories"
        className="max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tools, categories…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>
              <span className="text-muted-foreground">
                No results for “{query}”.
              </span>
            </CommandEmpty>

            {pages.length > 0 && (
              <CommandGroup heading="Go to">
                {pages.map((p) => (
                  <CommandItem
                    key={p.href}
                    value={`page:${p.href}`}
                    onSelect={() => go(p.href)}
                    className="gap-3 py-2"
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon name={p.icon} className="size-4" />
                    </span>
                    <span className="font-medium">{p.label}</span>
                    <span className="ml-auto shrink-0 font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                      Page
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tools.length > 0 && (
              <CommandGroup heading="Tools">
                {tools.slice(0, 8).map((doc) => (
                  <CommandItem
                    key={doc.href}
                    value={doc.href}
                    onSelect={() => go(doc.href)}
                    className="gap-3 py-2"
                  >
                    <ToolLogo
                      name={doc.name}
                      accent={doc.accent}
                      logo={doc.logo}
                      size="sm"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{doc.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {doc.tagline}
                      </span>
                    </span>
                    {doc.category && (
                      <span className="ml-auto shrink-0 font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                        {doc.category}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {cats.length > 0 && (
              <CommandGroup heading="Categories">
                {cats.map((doc) => (
                  <CommandItem
                    key={doc.href}
                    value={doc.href}
                    onSelect={() => go(doc.href)}
                    className="gap-3 py-2"
                  >
                    <span
                      className="grid size-8 place-items-center rounded-lg"
                      style={{
                        color: doc.accent,
                        background: `linear-gradient(150deg, ${doc.accent}22, transparent)`,
                      }}
                    >
                      <Icon name={doc.icon ?? "LayoutGrid"} className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{doc.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {doc.tagline}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </Ctx.Provider>
  );
}
