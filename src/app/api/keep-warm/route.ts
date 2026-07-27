import { NextResponse, type NextRequest } from "next/server";
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
 */
export const dynamic = "force-dynamic";

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
    // `tools` is public-readable, so this needs no privileged key. head:true
    // asks for a count with no rows, which is the cheapest round trip that
    // still counts as database activity.
    const { error } = await createAnonClient()
      .from("tools")
      .select("slug", { count: "exact", head: true });

    if (error) {
      console.error("[enki] keep-warm query failed", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[enki] keep-warm threw", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
