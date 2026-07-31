"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import { submissionFormSchema, type SubmissionValues } from "@/lib/schemas";
import { allowWrite } from "@/lib/rate-limit";

/**
 * Record a public tool submission. Validated server-side with the same Zod
 * schema the form uses; written with the anonymous client (RLS allows insert
 * only — nobody but an admin can read the queue back). Length limits are
 * mirrored as CHECK constraints in Postgres, since the anon key is public and
 * a direct REST caller never runs this code.
 */
export async function submitTool(values: SubmissionValues) {
  // A filled honeypot means a bot. Report success so it learns nothing.
  if (values.hp) return { ok: true as const };

  // Without a ceiling a script can flood the moderation queue faster than a
  // human can clear it. The honeypot above only stops naive form-fillers.
  if (!(await allowWrite("submit"))) {
    return {
      ok: false as const,
      error: "Too many submissions from here. Try again later.",
    };
  }

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

  if (error) {
    console.error("[enki] tool submission failed", error);
    return {
      ok: false as const,
      error: "Could not send your submission. Try again.",
    };
  }
  return { ok: true as const };
}
