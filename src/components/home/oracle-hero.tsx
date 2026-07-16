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

gsap.registerPlugin(ScrollTrigger);

export function OracleHero() {
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

      // Parallax drift + fade as the hero scrolls away (depth). Explicit
      // fromTo (opacity 1 -> 0.35) with immediateRender:false so it never
      // captures the intro's opacity:0 as its start — otherwise scrubbing back
      // to the top would leave the model hidden.
      gsap.fromTo(
        "[data-halo]",
        { yPercent: 0, opacity: 1 },
        {
          yPercent: 16,
          opacity: 0.35,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        },
      );
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
            "radial-gradient(48% 40% at 50% 46%, color-mix(in oklab, var(--background) 80%, transparent) 0%, transparent 72%)",
            "linear-gradient(to bottom, transparent 42%, color-mix(in oklab, var(--background) 50%, transparent) 74%, transparent 100%)",
          ].join(","),
        }}
      />

      {/* Copy */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
        <span
          data-hero-reveal
          className="tagline-pill relative mb-6 inline-flex items-center gap-2.5 overflow-hidden rounded-full px-4 py-1.5 font-mono text-xs tracking-wide text-mist/85"
        >
          {/* light that glints across the pill */}
          <span aria-hidden className="tagline-glint" />
          {/* live status dot */}
          <span
            aria-hidden
            className="relative inline-flex size-1.5 items-center justify-center"
          >
            <span className="absolute size-full animate-ping rounded-full bg-teal opacity-60" />
            <span className="size-1.5 rounded-full bg-teal-bright shadow-[0_0_8px_var(--brand-teal)]" />
          </span>
          <span className="relative">Human-vetted AI tool intelligence</span>
        </span>

        <h1
          data-hero-reveal
          className="text-balance text-5xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
        >
          The oracle for{" "}
          <br />
          <span className="text-glow">AI tools</span>
        </h1>

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
