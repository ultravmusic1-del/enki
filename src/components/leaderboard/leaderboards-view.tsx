"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { animate, stagger, utils } from "animejs";
import { useReducedMotion } from "motion/react";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { BorderBeam } from "@/components/shared/border-beam";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/content";

/* =========================================================================
   Leaderboards — two rankings of one tool set, switched by a segmented
   control. Each board = a podium (top 3) over a ledger (4–15). anime.js
   drives the entrance: podium plinths rise, score rings draw, numbers count
   up, and ledger rows stagger their meters into place.

   Motion strategy: the JSX renders the *final* state (numbers filled, meters
   full, everything visible) so the page is correct with no JS and under
   `prefers-reduced-motion`. When motion is allowed, a layout effect snaps the
   animatable nodes back to their start BEFORE paint, then animates forward —
   no flash of the finished state.
   ========================================================================= */

type BoardKey = "editor" | "user";

type BoardConfig = {
  key: BoardKey;
  tab: string;
  eyebrow: string;
  icon: string;
  /** Denominator shown next to the score, e.g. "/ 10". */
  unit: string;
  max: number;
  value: (e: LeaderboardEntry) => number;
  /** Label + accessor for this tool's standing on the *other* board. */
  otherLabel: string;
  otherRank: (e: LeaderboardEntry) => number;
  ownRank: (e: LeaderboardEntry) => number;
};

const BOARDS: Record<BoardKey, BoardConfig> = {
  editor: {
    key: "editor",
    tab: "Editors' Verdict",
    eyebrow: "Scored for capability, craft, and trust",
    icon: "Gauge",
    unit: "/ 10",
    max: 10,
    value: (e) => e.editorScore,
    otherLabel: "Community",
    otherRank: (e) => e.userRank,
    ownRank: (e) => e.editorRank,
  },
  user: {
    key: "user",
    tab: "People's Choice",
    eyebrow: "Aggregated from community ratings",
    icon: "Users",
    unit: "/ 5",
    max: 5,
    value: (e) => e.rating,
    otherLabel: "Editors",
    otherRank: (e) => e.editorRank,
    ownRank: (e) => e.userRank,
  },
};

const fmtScore = (v: number) => v.toFixed(1);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");

export function LeaderboardsView({
  editor,
  user,
}: {
  editor: LeaderboardEntry[];
  user: LeaderboardEntry[];
}) {
  const [active, setActive] = useState<BoardKey>("editor");
  const baseId = useId();
  const entries = active === "editor" ? editor : user;
  const config = BOARDS[active];
  const order: BoardKey[] = ["editor", "user"];

  return (
    <div className="mt-12">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Choose a leaderboard"
        className="glass ring-hairline relative mx-auto grid w-full max-w-md grid-cols-2 gap-1 rounded-full p-1"
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-full bg-teal/15 shadow-[inset_0_0_0_1px_rgb(var(--glow)/0.4)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]"
          style={{
            width: "calc(50% - 0.25rem)",
            transform: `translateX(${active === "user" ? "calc(100% + 0.25rem)" : "0"})`,
          }}
        />
        {order.map((key) => {
          const c = BOARDS[key];
          const selected = active === key;
          return (
            <button
              key={key}
              role="tab"
              id={`${baseId}-tab-${key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setActive(key)}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                name={c.icon}
                className={cn("size-4", selected ? "text-teal" : "opacity-70")}
              />
              {c.tab}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        {config.eyebrow}
      </p>

      {/* Board — keyed so switching remounts and replays the entrance. */}
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
      >
        <Board key={active} entries={entries} config={config} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- board */

// Client-only layout effect (avoids the SSR useLayoutEffect warning).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function Board({
  entries,
  config,
}: {
  entries: LeaderboardEntry[];
  config: BoardConfig;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const podium = entries.slice(0, 3);
  const ledger = entries.slice(3);

  // Meter fill is a *relative* standing within this board (30%–100%) so the
  // narrow spread of top scores still reads as a ranked bar.
  const values = entries.map(config.value);
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const meterPct = (v: number) =>
    0.3 + 0.7 * (vmax === vmin ? 1 : (v - vmin) / (vmax - vmin));

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;

    const podiumCards = Array.from(
      root.querySelectorAll<HTMLElement>("[data-podium]"),
    );
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-row]"));
    const meters = Array.from(
      root.querySelectorAll<HTMLElement>("[data-meter]"),
    );
    const rings = Array.from(
      root.querySelectorAll<SVGCircleElement>("[data-ring]"),
    );
    const counts = Array.from(
      root.querySelectorAll<HTMLElement>("[data-count]"),
    );

    const delayOf = (el: Element | null) =>
      Number(el?.getAttribute("data-delay") ?? 0);

    // Snap everything to its start frame before the browser paints.
    utils.set(podiumCards, { opacity: 0, translateY: 44, scale: 0.94 });
    utils.set(rows, { opacity: 0, translateY: 18 });
    utils.set(meters, { scaleX: 0 });
    rings.forEach((el) =>
      utils.set(el, { strokeDashoffset: Number(el.getAttribute("data-len")) }),
    );
    counts.forEach((el) => {
      el.textContent = el.getAttribute("data-dec") === "1" ? "0.0" : "0";
    });

    const anims = [
      animate(rows, {
        opacity: 1,
        translateY: 0,
        duration: 600,
        delay: stagger(50, { start: 380 }),
        ease: "out(3)",
      }),
      animate(meters, {
        scaleX: 1,
        duration: 880,
        delay: stagger(46, { start: 300 }),
        ease: "out(4)",
      }),
    ];

    // Podium cards rise on their own per-card delay (#2, #3, then #1 lands last).
    podiumCards.forEach((el) => {
      anims.push(
        animate(el, {
          opacity: 1,
          translateY: 0,
          scale: 1,
          duration: 880,
          delay: delayOf(el),
          ease: "out(3)",
        }),
      );
    });

    rings.forEach((ring) => {
      anims.push(
        animate(ring, {
          strokeDashoffset: Number(ring.getAttribute("data-off")),
          duration: 1150,
          delay: delayOf(ring.closest("[data-podium]")) + 220,
          ease: "out(4)",
        }),
      );
    });

    counts.forEach((el) => {
      const to = Number(el.getAttribute("data-to"));
      const dec = el.getAttribute("data-dec") === "1";
      const podiumDelay = el.hasAttribute("data-podium-count")
        ? delayOf(el.closest("[data-podium]")) + 240
        : 460;
      const proxy = { v: 0 };
      anims.push(
        animate(proxy, {
          v: to,
          duration: 1100,
          delay: podiumDelay,
          ease: "out(4)",
          onUpdate: () => {
            el.textContent = dec ? fmtScore(proxy.v) : fmtInt(proxy.v);
          },
        }),
      );
    });

    return () => anims.forEach((a) => a.pause());
  }, [reduce, config.key]);

  // Podium climax ordering: #2 enters, then #3, then #1 lands last.
  const podiumDelay: Record<number, number> = { 1: 260, 2: 0, 3: 120 };

  return (
    <div ref={rootRef} className="mt-10">
      {/* Podium */}
      <div className="flex flex-col items-stretch justify-center gap-4 md:flex-row md:items-end">
        {podium.map((entry) => (
          <PodiumCard
            key={entry.slug}
            entry={entry}
            config={config}
            delay={podiumDelay[entry.rank] ?? 0}
          />
        ))}
      </div>

      {/* Ledger */}
      {ledger.length > 0 && (
        <ol className="mt-6 flex flex-col gap-2.5">
          {ledger.map((entry) => (
            <LedgerRow
              key={entry.slug}
              entry={entry}
              config={config}
              meterPct={meterPct(config.value(entry))}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- podium card */

const RANK_META: Record<
  number,
  { label: string; icon: string; ring: string; medal: string }
> = {
  1: {
    label: "1st",
    icon: "Crown",
    ring: "var(--brand-teal-bright)",
    medal: "from-teal-bright/30 to-teal/5 text-teal-bright",
  },
  2: {
    label: "2nd",
    icon: "Trophy",
    ring: "var(--brand-teal)",
    medal: "from-teal/25 to-teal/5 text-teal",
  },
  3: {
    label: "3rd",
    icon: "Medal",
    ring: "var(--brand-teal-deep)",
    medal: "from-teal-deep/30 to-teal/5 text-teal",
  },
};

function PodiumCard({
  entry,
  config,
  delay,
}: {
  entry: LeaderboardEntry;
  config: BoardConfig;
  delay: number;
}) {
  const meta = RANK_META[entry.rank];
  const first = entry.rank === 1;
  const value = config.value(entry);
  // Desktop order places #1 in the center (2 · 1 · 3); mobile keeps rank order.
  const orderClass =
    entry.rank === 1
      ? "md:order-2"
      : entry.rank === 2
        ? "md:order-1"
        : "md:order-3";

  return (
    <Link
      href={`/tools/${entry.slug}`}
      data-podium
      data-delay={delay}
      aria-label={`#${entry.rank} ${entry.name}, ${fmtScore(value)} ${config.unit}`}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-3xl border border-border px-6 text-center transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-teal/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex-1",
        orderClass,
        first
          ? "bg-gradient-to-b from-teal/[0.09] to-card py-9 md:min-h-[24rem]"
          : "glass py-7 md:min-h-[21rem]",
      )}
    >
      {first && <BorderBeam duration={8} />}
      {/* Rank glow bleeding up from the plinth */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-70"
        style={{
          background: `radial-gradient(60% 100% at 50% 100%, color-mix(in oklab, ${meta.ring} 22%, transparent), transparent 70%)`,
        }}
      />

      {/* Crown / trophy floating above the medal */}
      <span
        aria-hidden
        className={cn(
          "grid place-items-center transition-transform duration-500 group-hover:-translate-y-0.5",
          first ? "text-teal-bright" : "text-muted-foreground",
        )}
      >
        <Icon name={meta.icon} className={first ? "size-6" : "size-5"} />
      </span>

      {/* Medal badge */}
      <span
        className={cn(
          "mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b px-3 py-1 font-mono text-[0.65rem] tracking-[0.15em] uppercase ring-1 ring-inset ring-white/10",
          meta.medal,
        )}
      >
        Rank {entry.rank}
      </span>

      {/* Score ring with the count-up value */}
      <div className="relative mt-5">
        <ScoreRing
          value={value}
          max={config.max}
          color={meta.ring}
          size={first ? 148 : 128}
        />
      </div>
      <span className="mt-1 font-mono text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase">
        {config.unit === "/ 10" ? "out of 10" : "out of 5"}
      </span>

      {/* Identity */}
      <div className="mt-5 flex flex-col items-center">
        <ToolLogo
          name={entry.name}
          accent={entry.accent}
          logo={entry.logo}
          size={first ? "md" : "sm"}
        />
        <h3
          className={cn(
            "mt-3 font-display leading-tight font-semibold",
            first ? "text-2xl" : "text-xl",
          )}
        >
          {entry.name}
        </h3>
        <span className="mt-1 font-mono text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
          {entry.categoryName}
        </span>
      </div>

      {config.key === "user" && (
        <div className="mt-3 flex items-center gap-2">
          <StarRating value={entry.rating} size={14} />
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {fmtInt(entry.reviewCount)} reviews
          </span>
        </div>
      )}

      <div className="mt-auto pt-5">
        <CrossRank entry={entry} config={config} />
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------- score ring */

function ScoreRing({
  value,
  max,
  color,
  size,
}: {
  value: number;
  max: number;
  color: string;
  size: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const off = c * (1 - pct);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          data-ring
          data-len={c}
          data-off={off}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ filter: "drop-shadow(0 0 6px rgb(var(--glow) / 0.45))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center">
        <span
          data-count
          data-podium-count
          data-to={value}
          data-dec="1"
          className="font-display text-3xl leading-none font-semibold tabular-nums"
        >
          {fmtScore(value)}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- ledger row */

function LedgerRow({
  entry,
  config,
  meterPct,
}: {
  entry: LeaderboardEntry;
  config: BoardConfig;
  meterPct: number;
}) {
  const value = config.value(entry);

  return (
    <li data-row>
      <Link
        href={`/tools/${entry.slug}`}
        className="group ring-hairline relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card/40 px-4 py-3.5 transition-[transform,border-color,background-color] duration-300 hover:translate-x-0.5 hover:border-teal/30 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
      >
        {/* Rank */}
        <span className="w-8 shrink-0 text-center font-mono text-lg font-medium text-muted-foreground tabular-nums transition-colors group-hover:text-teal">
          {entry.rank}
        </span>

        <ToolLogo
          name={entry.name}
          accent={entry.accent}
          logo={entry.logo}
          size="sm"
        />

        {/* Name + meter */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-base leading-tight font-semibold">
              {entry.name}
            </h3>
            <span className="hidden shrink-0 font-mono text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase sm:inline">
              {entry.categoryName}
            </span>
          </div>
          {/* Relative-standing meter */}
          <div className="mt-2 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-muted">
            <div
              data-meter
              className="h-full rounded-full bg-gradient-to-r from-teal-deep via-teal to-teal-bright"
              style={{
                width: `${meterPct * 100}%`,
                transformOrigin: "left center",
                boxShadow: "0 0 12px -2px rgb(var(--glow) / 0.6)",
              }}
            />
          </div>
        </div>

        {/* Cross-rank (hidden on the smallest screens) */}
        <div className="hidden shrink-0 md:block">
          <CrossRank entry={entry} config={config} compact />
        </div>

        {/* Stars for the community board */}
        {config.key === "user" && (
          <div className="hidden shrink-0 flex-col items-end gap-0.5 lg:flex">
            <StarRating value={entry.rating} size={13} />
            <span className="font-mono text-[0.6rem] text-muted-foreground">
              {fmtInt(entry.reviewCount)} reviews
            </span>
          </div>
        )}

        {/* Value */}
        <div className="flex shrink-0 items-baseline gap-1 tabular-nums">
          <span
            data-count
            data-to={value}
            data-dec="1"
            className="font-display text-2xl font-semibold text-foreground"
          >
            {fmtScore(value)}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {config.unit}
          </span>
        </div>
      </Link>
    </li>
  );
}

/* --------------------------------------------------------------- cross rank */

/**
 * Shows how the *other* cohort ranks this tool, with a direction cue: an
 * up-tick when the other board rates it higher, a down-tick when lower.
 */
function CrossRank({
  entry,
  config,
  compact = false,
}: {
  entry: LeaderboardEntry;
  config: BoardConfig;
  compact?: boolean;
}) {
  const own = config.ownRank(entry);
  const other = config.otherRank(entry);
  const delta = own - other; // >0 → other board ranks it higher
  const icon = delta > 0 ? "TrendingUp" : delta < 0 ? "TrendingDown" : "Minus";
  const tone =
    delta > 0
      ? "text-teal-bright"
      : delta < 0
        ? "text-muted-foreground"
        : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/40 px-2.5 py-1 font-mono text-[0.65rem] tracking-wide text-muted-foreground",
        compact && "px-2 py-0.5",
      )}
      title={`${config.otherLabel} rank this #${other}`}
    >
      <span className="uppercase opacity-70">{config.otherLabel}</span>
      <span className="text-foreground">#{other}</span>
      <Icon name={icon} className={cn("size-3", tone)} />
    </span>
  );
}
