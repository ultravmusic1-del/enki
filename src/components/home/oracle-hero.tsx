"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@/lib/use-gsap";
import { Aurora } from "@/components/shared/aurora";
import { Icon } from "@/components/shared/icon";
import { OracleModel } from "@/components/home/oracle-model";
import { useCommandMenu } from "@/components/layout/command-menu";
import type { SiteStats } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

export function OracleHero({ stats }: { stats: SiteStats }) {
  const root = useRef<HTMLElement>(null);
  const { setOpen } = useCommandMenu();

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Static end-state for reduced motion — everything simply visible.
      if (reduce) {
        gsap.set("[data-hero-reveal], [data-halo]", { opacity: 1, y: 0 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-halo]", { opacity: 0, duration: 1.3, ease: "power2.out" })
        .from(
          "[data-hero-reveal]",
          { opacity: 0, y: 24, duration: 0.8, stagger: 0.12 },
          "-=0.7",
        );

      // Parallax drift + fade as the hero scrolls away (depth).
      gsap.to("[data-halo]", {
        yPercent: 16,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-[92vh] items-center justify-center overflow-hidden pt-24 pb-16"
    >
      <Aurora intensity="strong" />

      {/* Oracle — 3D model of the Enki emblem, behind the copy */}
      <div
        data-halo
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
      >
        <OracleModel />
      </div>

      {/* Contrast scrim so the copy stays legible over the model — a soft pool
          of background behind the text plus a lower-band darkening. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: [
            "radial-gradient(52% 42% at 50% 60%, color-mix(in oklab, var(--background) 82%, transparent) 0%, transparent 72%)",
            "linear-gradient(to bottom, transparent 26%, color-mix(in oklab, var(--background) 55%, transparent) 66%, transparent 100%)",
          ].join(","),
        }}
      />

      {/* Copy */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
        <span
          data-hero-reveal
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 font-mono text-xs tracking-wide text-muted-foreground"
        >
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-teal" />
          Human-vetted AI tool intelligence
        </span>

        <h1
          data-hero-reveal
          className="text-balance text-5xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
        >
          The oracle for
          <br />
          <span className="text-glow">AI tools</span>
        </h1>

        <p
          data-hero-reveal
          className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground"
        >
          Enki curates and reviews the tools shaping the future of work — so you
          can discover, compare, and trust what you adopt. Wisdom for the age of
          AI.
        </p>

        <div
          data-hero-reveal
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group inline-flex w-64 items-center gap-3 rounded-full border border-border glass px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
          >
            <Icon name="Search" className="size-4 text-teal" />
            Search 27 tools…
            <kbd className="ml-auto rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6rem]">
              ⌘K
            </kbd>
          </button>

          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 rounded-full bg-mist px-6 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow"
          >
            Browse the directory
            <Icon name="ArrowRight" className="size-4" />
          </Link>
        </div>

        <dl
          data-hero-reveal
          className="mt-14 flex items-center gap-8 font-mono text-sm"
        >
          <Stat value={`${stats.toolCount}`} label="Tools vetted" />
          <span aria-hidden className="h-8 w-px bg-border" />
          <Stat value={`${stats.categoryCount}`} label="Categories" />
          <span aria-hidden className="h-8 w-px bg-border" />
          <Stat
            value={`${(stats.reviewCount / 1000).toFixed(1)}k`}
            label="Reviews"
          />
        </dl>
      </div>

      {/* Scroll cue */}
      <div
        data-hero-reveal
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground/60"
        aria-hidden
      >
        <Icon name="ChevronDown" className="size-5 animate-float" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dt className="sr-only">{label}</dt>
      <dd className="text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </dd>
      <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
