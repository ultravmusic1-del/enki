"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { animate, stagger, utils } from "animejs";
import { useReducedMotion } from "motion/react";
import { ToolLogo } from "@/components/shared/tool-logo";
import { BorderBeam } from "@/components/shared/border-beam";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/content";

/* =========================================================================
   Leaderboard — the editorial ranking of the tool set: a podium (top 3) over
   a ledger (4–15). anime.js drives the entrance: podium plinths rise, score
   rings draw, numbers count up, and ledger rows stagger their meters in.

   Motion strategy: the JSX renders the *final* state (numbers filled, meters
   full, everything visible) so the page is correct with no JS and under
   `prefers-reduced-motion`. When motion is allowed, a layout effect snaps the
   animatable nodes back to their start BEFORE paint, then animates forward —
   no flash of the finished state.
   ========================================================================= */

type BoardConfig = {
  key: string;
  eyebrow: string;
  /** Denominator shown next to the score, e.g. "/ 10". */
  unit: string;
  max: number;
  value: (e: LeaderboardEntry) => number;
  ownRank: (e: LeaderboardEntry) => number;
};

/**
 * One board, not two.
 *
 * There was a second "People's Choice" board ranked by an aggregate `rating`
 * and `reviewCount` that no user had ever contributed -- the figures were
 * editorial samples. Rather than dress an empty community board in an empty
 * state, the leaderboard now shows the one ranking Enki can stand behind.
 * A community board earns its place back when there are approved reviews to
 * build it from.
 */
const EDITOR_BOARD: BoardConfig = {
  key: "editor",
  eyebrow: "Scored for capability, craft, and trust",
  unit: "/ 10",
  max: 10,
  value: (e) => e.editorScore,
  ownRank: (e) => e.editorRank,
};

const fmtScore = (v: number) => v.toFixed(1);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");

export function LeaderboardsView({ editor }: { editor: LeaderboardEntry[] }) {
  const config = EDITOR_BOARD;

  return (
    <div className="mt-12">
      <p className="text-center font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        {config.eyebrow}
      </p>

      <Board entries={editor} config={config} />
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
        out of {config.max}
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

      <div className="mt-auto pt-5" />
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

