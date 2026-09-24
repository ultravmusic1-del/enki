"use client";

import { useEffect, useRef, useState } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The iframe is rendered with no `src` on the server and on first client
  // render, and only assigned one imperatively here, after mount. That
  // guarantees the `onLoad` prop (attached when the node is created, before
  // this effect runs) is always listening before the request can start: a
  // server-rendered `src` lets a fast cache hit fire `load` before React
  // attaches the listener, and `loaded` never flips.
  useEffect(() => {
    if (iframeRef.current) iframeRef.current.src = config.src;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on mount
  }, []);

  useEffect(() => {
    if (!config.src || loaded) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;

    const armTimer = () => {
      timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    };

    // Non-lazy embeds start counting toward the fallback as soon as they
    // mount. Lazy embeds don't request the iframe until it nears the
    // viewport, so counting from mount would replace a healthy, not-yet-
    // requested form with the fallback for a slow scroller. Wait for the
    // wrapper to be near the viewport instead, unless IntersectionObserver
    // isn't available (old browser, some test environments), in which case
    // fall back to the mount-time timer.
    if (!lazy || typeof IntersectionObserver === "undefined") {
      armTimer();
    } else if (wrapperRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            armTimer();
            observer?.disconnect();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(wrapperRef.current);
    }

    return () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
    };
  }, [config.src, loaded, lazy]);

  if (!config.src || (timedOut && !loaded)) {
    return (
      <div className={cn("flex min-h-11 items-center", className)}>
        <Fallback />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
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
        ref={iframeRef}
        title="Subscribe to Enki Daily"
        loading={lazy ? "lazy" : "eager"}
        onLoad={() => setLoaded(true)}
        className={cn(
          "relative block h-[var(--embed-h)] w-full border-0 bg-transparent sm:h-[var(--embed-h-sm)]",
          !loaded && "opacity-0",
        )}
        scrolling="no"
        // The page is color-scheme: dark and beehiiv's form document is not;
        // on that mismatch Chrome paints an opaque white backdrop behind the
        // frame. Matching the form's scheme keeps it transparent.
        style={{ colorScheme: "normal" }}
      />
      {NEWSLETTER.hostedUrl ? (
        <noscript>
          <a href={NEWSLETTER.hostedUrl}>Subscribe to Enki Daily</a>
        </noscript>
      ) : null}
    </div>
  );
}
