"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = ["approved", "flagged", "rejected"] as const;
export type ReviewStatus = (typeof ALLOWED)[number];

/**
 * Set a review's moderation status. Authorization is enforced by RLS (only
 * admins may update rows they don't own); the status whitelist guards against
 * a bad value reaching the CHECK constraint.
 */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  if (!ALLOWED.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Set a tool submission's status. Authorization is enforced by RLS (only
 * admins may read or update the queue).
 */
export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
) {
  if (!SUBMISSION_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tool_submissions")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
