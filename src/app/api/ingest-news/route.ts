import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { runNewsIngest } from "@/lib/news/run-ingest";

/**
 * Daily news ingestion, driven by a Vercel Cron (see vercel.json).
 *
 * Unlike keep-warm, this fails closed when CRON_SECRET is unset: each run
 * makes outbound requests to every feed, so it must not be a public trigger.
 *
 * Wrapped in a Sentry check-in for the same reason as keep-warm: a job that
 * stops running is silent from the outside.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Must match vercel.json's cron entry, or Sentry reports phantom misses. */
const MONITOR_SLUG = "ingest-news";
const MONITOR_CONFIG = {
  schedule: { type: "crontab", value: "0 5 * * *" },
  maxRuntime: 2,
  // Hobby-plan crons may fire any time within the scheduled hour.
  checkinMargin: 60,
  timezone: "Etc/UTC",
} as const;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await Sentry.withMonitor(
      MONITOR_SLUG,
      async () => {
        const result = await runNewsIngest();
        // Thrown, not returned: withMonitor marks the check-in failed only
        // when the callback throws.
        if (result.sources > 0 && result.failed.length === result.sources) {
          throw new Error(`every news source failed: ${result.failed.join(", ")}`);
        }
        return result;
      },
      MONITOR_CONFIG,
    );
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[enki] ingest-news failed", error);
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 503 });
  } finally {
    // See keep-warm: a frozen function would otherwise drop the check-in.
    await Sentry.flush(2000);
  }
}
