"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CompareTool } from "@/lib/content";
import { outboundHref } from "@/lib/outbound";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const MAX = 4;
// Sensible default line-up when someone arrives with an empty comparison.
const SUGGESTED = ["cursor", "github-copilot", "perplexity", "jasper"];

export function CompareView({ tools }: { tools: CompareTool[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bySlug = useMemo(
    () => new Map(tools.map((t) => [t.slug, t])),
    [tools],
  );

  const [selected, setSelected] = useState<string[]>(() => {
    const raw = searchParams.get("tools");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => bySlug.has(s))
      .slice(0, MAX);
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mirror the selection into the URL so a comparison is shareable.
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (selected.length) params.set("tools", selected.join(","));
    else params.delete("tools");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Only re-sync when the selection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const chosen = selected
    .map((s) => bySlug.get(s))
    .filter((t): t is CompareTool => Boolean(t));
  const addable = tools.filter((t) => !selected.includes(t.slug));
  const canAdd = selected.length < MAX;

  const add = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) || prev.length >= MAX ? prev : [...prev, slug],
    );
    setPickerOpen(false);
  };
  const remove = (slug: string) =>
    setSelected((prev) => prev.filter((s) => s !== slug));

  const bestEditor = chosen.length
    ? Math.max(...chosen.map((t) => t.editorScore))
    : 0;
  const bestRating = chosen.length
    ? Math.max(...chosen.map((t) => t.rating))
    : 0;

  const gridTemplate = {
    gridTemplateColumns: `minmax(128px, 168px) repeat(${chosen.length}, minmax(212px, 1fr))`,
  };

  return (
    <div className="mt-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={!canAdd}
              className="gap-2 rounded-full border-teal/30 bg-teal/5 text-foreground hover:border-teal/50 hover:bg-teal/10"
            >
              <Icon name="Plus" className="size-4 text-teal" />
              Add a tool
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search tools…" />
              <CommandList>
                <CommandEmpty>No tools found.</CommandEmpty>
                <CommandGroup>
                  {addable.map((t) => (
                    <CommandItem
                      key={t.slug}
                      value={t.name}
                      onSelect={() => add(t.slug)}
                      className="gap-2.5"
                    >
                      <ToolLogo
                        name={t.name}
                        accent={t.accent}
                        logo={t.logo}
                        size="sm"
                        className="size-6 rounded-md p-1"
                      />
                      <span className="truncate">{t.name}</span>
                      <span className="ml-auto font-mono text-[0.65rem] text-muted-foreground">
                        {t.categoryName}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <span className="font-mono text-xs text-muted-foreground">
          {selected.length}/{MAX} selected
        </span>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="X" className="size-3.5" />
            Clear all
          </button>
        )}
      </div>

      {chosen.length === 0 ? (
        <EmptyState tools={tools} onAdd={add} />
      ) : (
        <div className="ring-hairline mt-6 overflow-x-auto rounded-2xl border border-border">
          <div style={gridTemplate} className="grid min-w-fit">
            {/* Identity header row */}
            <div className="sticky left-0 z-10 bg-background" aria-hidden />
            {chosen.map((t) => (
              <div
                key={t.slug}
                className="relative flex flex-col items-start gap-3 border-l border-border bg-card/40 p-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
                  }}
                />
                <div className="flex w-full items-start justify-between gap-2">
                  <ToolLogo
                    name={t.name}
                    accent={t.accent}
                    logo={t.logo}
                    size="md"
                  />
                  <button
                    type="button"
                    onClick={() => remove(t.slug)}
                    aria-label={`Remove ${t.name}`}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Icon name="X" className="size-4" />
                  </button>
                </div>
                <div>
                  <h3 className="font-display text-lg leading-tight font-semibold">
                    {t.name}
                  </h3>
                  <span className="font-mono text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase">
                    {t.categoryName}
                  </span>
                </div>
                <p className="text-sm text-pretty text-muted-foreground">
                  {t.tagline}
                </p>
              </div>
            ))}

            {/* Attribute rows */}
            <Row label="Editor score">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <Superlative active={chosen.length > 1 && t.editorScore === bestEditor}>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl font-semibold tabular-nums">
                        {t.editorScore.toFixed(1)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        / 10
                      </span>
                    </div>
                  </Superlative>
                  <Meter pct={t.editorScore / 10} />
                </Cell>
              ))}
            </Row>

            <Row label="Community">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <Superlative active={chosen.length > 1 && t.rating === bestRating}>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-semibold tabular-nums">
                        {t.rating.toFixed(1)}
                      </span>
                      <StarRating value={t.rating} size={13} />
                    </div>
                  </Superlative>
                  <span className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                    {t.reviewCount.toLocaleString("en-US")} reviews
                  </span>
                </Cell>
              ))}
            </Row>

            <Row label="Pricing">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <PricingBadge model={t.pricingModel} />
                  {t.startingPrice && (
                    <span className="mt-2 block text-sm text-foreground">
                      from {t.startingPrice}
                    </span>
                  )}
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 font-mono text-[0.65rem]",
                      t.hasFreeTrial ? "text-teal" : "text-muted-foreground",
                    )}
                  >
                    <Icon
                      name={t.hasFreeTrial ? "Check" : "Minus"}
                      className="size-3"
                    />
                    {t.hasFreeTrial ? "Free trial" : "No free trial"}
                  </span>
                </Cell>
              ))}
            </Row>

            <Row label="Platforms">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <div className="flex flex-wrap gap-1.5">
                    {t.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </Cell>
              ))}
            </Row>

            <Row label="Strengths">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <ul className="flex flex-col gap-1.5">
                    {t.pros.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-pretty">
                        <Icon
                          name="Check"
                          className="mt-0.5 size-3.5 shrink-0 text-teal"
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Cell>
              ))}
            </Row>

            <Row label="Trade-offs">
              {chosen.map((t) => (
                <Cell key={t.slug}>
                  <ul className="flex flex-col gap-1.5">
                    {t.cons.map((c) => (
                      <li
                        key={c}
                        className="flex gap-2 text-sm text-pretty text-muted-foreground"
                      >
                        <Icon
                          name="Minus"
                          className="mt-0.5 size-3.5 shrink-0"
                        />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Cell>
              ))}
            </Row>

            {/* Actions row */}
            <div className="sticky left-0 z-10 bg-background" aria-hidden />
            {chosen.map((t) => (
              <div
                key={t.slug}
                className="flex flex-col gap-2 border-t border-l border-border p-4"
              >
                <Link
                  href={`/tools/${t.slug}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mist px-4 py-2 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px"
                >
                  View details
                  <Icon name="ArrowRight" className="size-3.5" />
                </Link>
                <a
                  href={outboundHref(t.slug)}
                  target="_blank"
                  rel={
                    t.isAffiliate
                      ? "sponsored noopener noreferrer"
                      : "noopener noreferrer"
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                >
                  Visit site
                  <Icon name="ExternalLink" className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- fragments */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-start border-t border-border bg-background p-4">
        <span className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      {children}
    </>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-t border-l border-border p-4">
      {children}
    </div>
  );
}

/** Wraps a metric and, when it's the best of the row, badges it. */
function Superlative({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      {active && (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wide text-teal-bright uppercase">
          <Icon name="Crown" className="size-2.5" />
          Best
        </span>
      )}
    </div>
  );
}

function Meter({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-deep via-teal to-teal-bright"
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }}
      />
    </div>
  );
}

function EmptyState({
  tools,
  onAdd,
}: {
  tools: CompareTool[];
  onAdd: (slug: string) => void;
}) {
  const picks = SUGGESTED.map((s) => tools.find((t) => t.slug === s)).filter(
    (t): t is CompareTool => Boolean(t),
  );

  return (
    <div className="glass ring-hairline mt-6 flex flex-col items-center rounded-2xl border border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-teal/10 text-teal">
        <Icon name="Scale" className="size-7" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold">
        Nothing to compare yet
      </h2>
      <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
        Add up to four tools to see them side by side. Start with a popular
        match-up or search for your own.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {picks.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => onAdd(t.slug)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 text-sm transition-colors hover:border-teal/40 hover:bg-card"
          >
            <ToolLogo
              name={t.name}
              accent={t.accent}
              logo={t.logo}
              size="sm"
              className="size-5 rounded p-0.5"
            />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
