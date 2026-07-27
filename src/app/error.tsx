"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/icon";

/**
 * Route-level error boundary.
 *
 * Without this, an unhandled runtime error drops the visitor onto Next's raw
 * error page. It also logs to the server, where Vercel captures it -- until a
 * real error tracker (Sentry) is wired up, that log is the only signal that
 * anything broke for a real user.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[enki] unhandled route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Icon name="TriangleAlert" className="size-7" />
        </span>

        <h1 className="mt-6 font-display text-3xl font-semibold">
          Something went wrong
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          That is on us, not you. Try again, and if it keeps happening let us
          know at{" "}
          <a
            href="mailto:enkidirectory@gmail.com"
            className="text-teal hover:underline"
          >
            enkidirectory@gmail.com
          </a>
          .
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] transition-all hover:-translate-y-0.5 hover:bg-teal-bright"
          >
            <Icon name="RotateCw" className="size-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
          >
            Back to Enki
          </Link>
        </div>
      </div>
    </div>
  );
}
