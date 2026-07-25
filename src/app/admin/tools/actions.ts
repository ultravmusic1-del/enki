"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toolSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { invalidateToolCache } from "@/lib/content";

/**
 * Create or update a tool. The full object is validated against toolSchema
 * (the single content contract), then written to the `tools` table. RLS
 * enforces admin-only writes; the read layer merges it over the seed. We
 * revalidate the whole app since a tool surfaces across many routes.
 */
export async function saveTool(rawJson: string, published: boolean) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false as const, error: "Invalid JSON — check for typos." };
  }

  const result = toolSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false as const,
      error: z.prettifyError(result.error),
    };
  }

  const tool = result.data;
  const supabase = await createClient();
  const { error } = await supabase.from("tools").upsert({
    slug: tool.slug,
    data: tool,
    published,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };

  invalidateToolCache();
  revalidatePath("/", "layout");
  return { ok: true as const, slug: tool.slug };
}

/** Remove a tool's DB row — it reverts to the seed version if one exists. */
export async function deleteTool(slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tools").delete().eq("slug", slug);
  if (error) return { ok: false as const, error: error.message };

  invalidateToolCache();
  revalidatePath("/", "layout");
  return { ok: true as const };
}
