"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { toolSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { invalidateToolCache } from "@/lib/content";

/**
 * Revalidating the whole app is expensive (it re-renders ~180 routes and reads
 * the database for each). Only ever do it after a write that actually changed
 * something, and only for a verified admin — otherwise the action doubles as a
 * free cache-busting endpoint for anyone who can send a POST.
 */
function revalidateEverything() {
  invalidateToolCache();
  revalidatePath("/", "layout");
}

/**
 * Create or update a tool. The full object is validated against toolSchema
 * (the single content contract), then written to the `tools` table. RLS
 * enforces admin-only writes; the read layer merges it over the seed.
 */
export async function saveTool(rawJson: string, published: boolean) {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false as const, error: "Invalid JSON — check for typos." };
  }

  const result = toolSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false as const, error: z.prettifyError(result.error) };
  }

  const tool = result.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tools")
    .upsert({
      slug: tool.slug,
      data: tool,
      published,
      updated_at: new Date().toISOString(),
    })
    .select("slug");

  if (error) {
    console.error("[enki] saveTool failed", error);
    return { ok: false as const, error: "Could not save the tool. Try again." };
  }
  if (!data || data.length === 0) {
    return {
      ok: false as const,
      error: "The save did not apply. Check your admin access and try again.",
    };
  }

  revalidateEverything();
  return { ok: true as const, slug: tool.slug };
}

/** Remove a tool's DB row — it reverts to the seed version if one exists. */
export async function deleteTool(slug: string) {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tools")
    .delete()
    .eq("slug", slug)
    .select("slug");

  if (error) {
    console.error("[enki] deleteTool failed", error);
    return { ok: false as const, error: "Could not delete the tool. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false as const, error: "There is no database row for that tool." };
  }

  revalidateEverything();
  return { ok: true as const };
}
