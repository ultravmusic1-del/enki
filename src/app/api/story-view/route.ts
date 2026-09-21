import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { allowWrite } from "@/lib/rate-limit";
import { createAnonClient } from "@/lib/supabase/anon";

const bodySchema = z.object({ storyId: z.uuid() });

/**
 * Records one anonymous view of a published story, for the Popular rail.
 * Stores the story id and a timestamp, nothing about the visitor. RLS refuses
 * views of anything unpublished, so a forged id can only ever count toward a
 * real published story.
 *
 * Any valid body gets 204: a view is best-effort telemetry, and the response
 * must not reveal whether a story exists or whether the view was counted.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (await allowWrite("story-view", { request })) {
    try {
      const { error } = await createAnonClient()
        .from("story_views")
        .insert({ story_id: parsed.data.storyId });
      // 42501 is RLS refusing an unpublished or unknown story: expected.
      if (error && (error as { code?: string }).code !== "42501") {
        console.error("[enki] story view insert failed", error);
      }
    } catch (error) {
      console.error("[enki] story view insert threw", error);
    }
  }

  return new NextResponse(null, { status: 204 });
}
