import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Keeps the Supabase project awake.
 *
 * The free plan pauses a project after ~7 days without activity. When that
 * happens the public pages carry on serving the static seed, so the site looks
 * healthy from the outside -- but signup and login fail outright, which is the
 * one thing a new visitor is trying to do. This is the cheapest fix: one
 * trivial query a day, driven by a Vercel Cron (see vercel.json).
 *
 * Move to Supabase Pro when there is user data worth restoring; Pro's real
 * value is daily backups, not uptime.
 *
 * Wrapped in a Sentry check-in because this job's failure mode is silence. If
 * it stops running -- or runs and fails -- the public pages carry on serving
 * the seed and nothing looks wrong from outside, right up until a visitor
 * tries to sign up. `checkInMonitor` also reports a *missed* run, which a
 * try/catch inside the handler cannot: an invocation that never happens throws
 * nothing.
 */
export const dynamic = "force-dynamic";

/** Must match vercel.json's cron entry, or Sentry reports phantom misses. */
const MONITOR_SLUG = "keep-warm";
const MONITOR_CONFIG = {
  schedule: { type: "crontab", value: "0 6 * * *" },
  // The job is a single trivial query; a minute is generous.
  maxRuntime: 1,
  // Vercel cron firing time drifts a little; allow for it before alerting.
  checkinMargin: 10,
  timezone: "Etc/UTC",
} as const;

export async function GET(request: NextRequest) {
  // Vercel signs cron invocations with CRON_SECRET when it is configured.
  // Guarding is optional but stops the endpoint being used as a free pinger.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    await Sentry.withMonitor(
      MONITOR_SLUG,
      async () => {
        // `tools` is public-readable, so this needs no privileged key.
        // head:true asks for a count with no rows, which is the cheapest round
        // trip that still counts as database activity.
        const { error } = await createAnonClient()
          .from("tools")
          .select("slug", { count: "exact", head: true });

        // Thrown rather than returned on purpose. withMonitor derives the
        // check-in status from whether this callback throws, so returning the
        // failure would record a healthy run and defeat the monitor.
        if (error) {
          throw new Error(`keep-warm query failed: ${error.message}`);
        }
      },
      MONITOR_CONFIG,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[enki] keep-warm failed", error);
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 503 });
  } finally {
    // Serverless functions can be frozen the instant a response is returned,
    // before Sentry's transport has flushed. The check-in is then computed and
    // discarded -- indistinguishable, from Sentry's side, from the job never
    // running at all, which would make this monitor worse than useless: it
    // would alert on healthy runs. This costs a few hundred milliseconds on a
    // once-a-day job.
    await Sentry.flush(2000);
  }
}
