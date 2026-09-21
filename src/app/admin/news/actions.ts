"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { runNewsIngest } from "@/lib/news/run-ingest";
import type { IngestSummary } from "@/lib/news/ingest";
import { makeStorySlug } from "@/lib/news/slug";
import {
  newsSourceInputSchema,
  storyPublishSchema,
  type NewsSourceInput,
  type StoryPublishInput,
} from "@/lib/news/schemas";

type Fail = { ok: false; error: string };

/**
 * Every action here calls assertAdmin() itself: server actions are public POST
 * endpoints, and RLS alone cannot stop a caller triggering their side effects.
 */

export async function publishStory(
  input: StoryPublishInput,
): Promise<{ ok: true; slug: string } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const parsed = storyPublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
  const story = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_publish_story", {
    p_story_id: story.id,
    p_slug: makeStorySlug(story.headline, story.id),
    p_headline: story.headline,
    p_summary: story.summary,
    p_take: story.take ?? null,
    p_beat: story.beat,
    p_featured: story.featured,
    p_tool_slugs: story.toolSlugs,
  });

  if (error) {
    console.error("[enki] publishStory failed", error);
    return { ok: false, error: "Could not publish the story. Try again." };
  }
  if (!data) return { ok: false, error: "That story is no longer in the queue." };

  revalidatePath("/admin/news");
  // Public story, archive and beat pages are cached; refresh them all.
  revalidatePath("/news", "layout");
  return { ok: true, slug: data };
}

export type StoryStatusChange = "rejected" | "pending";

export async function setStoryStatus(
  id: string,
  status: StoryStatusChange,
): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  if (status !== "rejected" && status !== "pending") {
    return { ok: false, error: "Unknown status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_story_status", {
    p_story_id: id,
    p_status: status,
  });
  if (error) {
    console.error("[enki] setStoryStatus failed", error);
    return { ok: false, error: "Could not update the story. Try again." };
  }
  if (!data) return { ok: false, error: "That story has already moved on." };

  revalidatePath("/admin/news");
  // Public story, archive and beat pages are cached; refresh them all.
  revalidatePath("/news", "layout");
  return { ok: true };
}

export async function fetchNewsNow(): Promise<{ ok: true; summary: IngestSummary } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const summary = await runNewsIngest();
    revalidatePath("/admin/news");
    return { ok: true, summary };
  } catch (error) {
    console.error("[enki] fetchNewsNow failed", error);
    return {
      ok: false,
      error: "Fetching failed. Check NEWS_INGEST_SECRET matches the Vault secret.",
    };
  }
}

export async function addNewsSource(input: NewsSourceInput): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const parsed = newsSourceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("news_sources").insert({
    name: parsed.data.name,
    feed_url: parsed.data.feedUrl,
    site_url: parsed.data.siteUrl,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "That feed is already a source." };
    }
    console.error("[enki] addNewsSource failed", error);
    return { ok: false, error: "Could not add the source. Try again." };
  }

  revalidatePath("/admin/news/sources");
  return { ok: true };
}

export async function setNewsSourceActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_sources")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[enki] setNewsSourceActive failed", error);
    return { ok: false, error: "Could not update the source. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "The update did not apply. Check your admin access." };
  }

  revalidatePath("/admin/news/sources");
  return { ok: true };
}
