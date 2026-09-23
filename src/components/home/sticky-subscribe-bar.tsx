"use client";

import { useEffect, useState } from "react";

const KEY = "enki-daily-bar-dismissed";

export function barVisible(s: { heroVisible: boolean; bandVisible: boolean; dismissed: boolean }): boolean {
  return !s.heroVisible && !s.bandVisible && !s.dismissed;
}

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Phones only: a slim bar that returns the reader to the hero form. */
export function StickySubscribeBar() {
  const [heroVisible, setHeroVisible] = useState(true);
  const [bandVisible, setBandVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => readDismissed());

  useEffect(() => {
    const hero = document.getElementById("subscribe");
    const bands = Array.from(document.querySelectorAll("[data-subscribe-band]"));
    const visibleBands = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        else {
          if (entry.isIntersecting) visibleBands.add(entry.target);
          else visibleBands.delete(entry.target);
          setBandVisible(visibleBands.size > 0);
        }
      }
    });
    if (hero) observer.observe(hero);
    bands.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);

  if (!barVisible({ heroVisible, bandVisible, dismissed })) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode or blocked storage: closed for this page view only.
    }
  };

  const toForm = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("subscribe")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <section
      aria-label="Subscribe to Enki Daily"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-full border border-border bg-[#1b2028]/95 py-2 pr-2 pl-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur md:hidden"
    >
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold">Enki Daily</span>
        <span className="text-muted-foreground"> · free, every weekday</span>
      </p>
      <button type="button" onClick={toForm} className="h-9 shrink-0 rounded-full bg-teal px-4 text-sm font-semibold text-[#04171a]">
        Get it
      </button>
      <button type="button" onClick={dismiss} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
        &times;
      </button>
    </section>
  );
}
