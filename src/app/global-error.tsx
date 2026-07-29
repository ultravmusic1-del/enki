"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 *
 * It replaces the whole document, so it must render its own <html> and <body>
 * and cannot rely on the app's fonts, providers, or CSS variables. Styles are
 * inline for that reason. Keep the render path dependency-free: anything
 * imported for rendering here is something that can also fail here.
 *
 * The Sentry import is the deliberate exception. It is already initialised by
 * instrumentation-client before any layout code runs, and this is the one
 * boundary that catches failures nothing else will — an error here with no
 * report is completely invisible. The capture is confined to the effect, so a
 * failure inside it cannot stop the fallback UI rendering.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[enki] unhandled root error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#16191D",
          color: "#EEEEEE",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>
            Enki is having a moment
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#9AA3AB", lineHeight: 1.6 }}>
            Something failed before the page could load. Try again, and if it
            persists let us know at{" "}
            <a
              href="mailto:enkidirectory@gmail.com"
              style={{ color: "#00ADB5" }}
            >
              enkidirectory@gmail.com
            </a>
            .
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                color: "#6B7480",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              height: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "9999px",
              border: "none",
              background: "#00ADB5",
              color: "#04171a",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
