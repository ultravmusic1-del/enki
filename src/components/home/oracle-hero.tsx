"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@/lib/use-gsap";
import { Aurora } from "@/components/shared/aurora";
import { Icon } from "@/components/shared/icon";
import { useCommandMenu } from "@/components/layout/command-menu";
import type { SiteStats } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

const RAY_COUNT = 32;

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
        gsap.set("[data-hero-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-ray]", { opacity: 0.5, scaleY: 1 });
        gsap.set("[data-emblem]", { opacity: 1, scale: 1 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from("[data-emblem]", {
        opacity: 0,
        scale: 0.6,
        duration: 1.1,
        ease: "power2.out",
      })
        .from(
          "[data-ray]",
          {
            opacity: 0,
            scaleY: 0,
            duration: 0.9,
            stagger: { each: 0.018, from: "random" },
            ease: "power2.out",
          },
          "-=0.7",
        )
        .from(
          "[data-hero-reveal]",
          {
            opacity: 0,
            y: 24,
            duration: 0.8,
            stagger: 0.12,
          },
          "-=0.5",
        );

      // Slow, continuous rotation of the ray halo.
      gsap.to("[data-rays]", {
        rotate: 360,
        duration: 240,
        repeat: -1,
        ease: "none",
      });

      // Gentle breathing glow on the emblem.
      gsap.to("[data-emblem]", {
        scale: 1.04,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Parallax drift as the hero scrolls away.
      gsap.to("[data-halo]", {
        yPercent: 18,
        opacity: 0.4,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Pointer parallax.
      const onMove = (e: PointerEvent) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        gsap.to("[data-halo]", {
          x: dx * 26,
          y: dy * 26,
          duration: 0.8,
          ease: "power2.out",
        });
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-[92vh] items-center justify-center overflow-hidden pt-24 pb-16"
    >
      <Aurora intensity="strong" />

      {/* Oracle halo — emblem + radiating rays, behind the copy */}
      <div
        data-halo
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 grid place-items-center"
      >
        <div className="relative grid size-[min(80vw,620px)] place-items-center">
          <div data-rays className="absolute inset-0">
            {Array.from({ length: RAY_COUNT }).map((_, i) => (
              <span
                key={i}
                data-ray
                className="absolute top-1/2 left-1/2 h-[46%] w-px origin-top"
                style={{
                  transform: `translate(-50%, 0) rotate(${(360 / RAY_COUNT) * i}deg)`,
                  background:
                    "linear-gradient(to bottom, rgb(var(--glow) / 0.55), transparent)",
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          <div
            data-emblem
            className="emblem size-40 sm:size-52"
            style={{
              color: "var(--brand-teal)",
              filter: "drop-shadow(0 0 40px rgb(var(--glow) / 0.55))",
            }}
          />
        </div>
      </div>

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
