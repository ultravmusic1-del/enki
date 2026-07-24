"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import { submissionFormSchema, type SubmissionValues } from "@/lib/schemas";

/**
 * Record a public tool submission. Validated server-side with the same Zod
 * schema the form uses; written with the anonymous client (RLS allows insert
 * only — nobody but an admin can read the queue back).
 */
export async function submitTool(values: SubmissionValues) {
  const parsed = submissionFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false as const, error: "Please check the form and try again." };
  }

  const v = parsed.data;
  const supabase = createAnonClient();
  const { error } = await supabase.from("tool_submissions").insert({
    name: v.name.trim(),
    url: v.url.trim(),
    category_slug: v.categorySlug || null,
    pitch: v.pitch?.trim() || null,
    submitter_email: v.submitterEmail?.trim() || null,
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
