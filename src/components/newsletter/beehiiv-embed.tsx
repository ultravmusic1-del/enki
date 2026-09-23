"use client";

import { useEffect, useState } from "react";
import { NEWSLETTER, type NewsletterForm } from "@/lib/newsletter";
import { cn } from "@/lib/utils";

const LOAD_TIMEOUT_MS = 8000;

function Fallback() {
  if (!NEWSLETTER.hostedUrl) {
    return <p className="text-sm text-muted-foreground">Signups open soon.</p>;
  }
  return (
    <a
      href={NEWSLETTER.hostedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] shadow-glow-sm hover:bg-teal-bright"
    >
      Subscribe to Enki Daily
      <span aria-hidden="true">&rarr;</span>
    </a>
  );
}

/** A beehiiv subscribe form. Reserves its height so the page never shifts. */
export function BeehiivEmbed({ form, lazy = false, className }: { form: NewsletterForm; lazy?: boolean; className?: string }) {
  const config = NEWSLETTER.forms[form];
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!config.src || loaded) return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [config.src, loaded]);

  if (!config.src || (timedOut && !loaded)) {
    return (
      <div className={cn("flex min-h-11 items-center", className)}>
        <Fallback />
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ ["--embed-h" as string]: `${config.mobileHeight}px`, ["--embed-h-sm" as string]: `${config.height}px` }}
    >
      {!loaded ? (
        <div
          data-testid="embed-skeleton"
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-full border border-border bg-white/[0.035]"
        />
      ) : null}
      <iframe
        src={config.src}
        title="Subscribe to Enki Daily"
        loading={lazy ? "lazy" : "eager"}
        onLoad={() => setLoaded(true)}
        className={cn(
          "relative block h-[var(--embed-h)] w-full border-0 bg-transparent sm:h-[var(--embed-h-sm)]",
          !loaded && "opacity-0",
        )}
        scrolling="no"
      />
      <noscript>
        <a href={NEWSLETTER.hostedUrl || "/"}>Subscribe to Enki Daily</a>
      </noscript>
    </div>
  );
}
