"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

const REVIEW_STATUSES = ["pending", "approved", "flagged", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Set a review's moderation status.
 *
 * Authorization is checked three times over: here (so an unauthorized caller
 * cannot trigger a revalidation), inside `admin_set_review_status` (which
 * self-guards with is_admin()), and by the column grants that stop `status`
 * being written any other way.
 */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  if (!REVIEW_STATUSES.includes(status)) {
    return { ok: false as const, error: "That is not a valid review status." };
  }

  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_review_status", {
    review_id: id,
    new_status: status,
  });

  if (error) {
    console.error("[enki] admin_set_review_status failed", error);
    return { ok: false as const, error: "Could not update the review." };
  }
  if (!data) {
    return { ok: false as const, error: "That review no longer exists." };
  }

  revalidatePath("/admin");
  return { ok: true as const };
}

const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Set a tool submission's status. RLS restricts the write to admins; the gate
 * here stops an unauthorized caller from reaching the revalidation below.
 */
export async function setSubmissionStatus(id: string, status: SubmissionStatus) {
  if (!SUBMISSION_STATUSES.includes(status)) {
    return { ok: false as const, error: "That is not a valid submission status." };
  }

  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_submissions")
    .update({ status })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[enki] submission status update failed", error);
    return { ok: false as const, error: "Could not update the submission." };
  }
  if (!data || data.length === 0) {
    return { ok: false as const, error: "That submission no longer exists." };
  }

  revalidatePath("/admin");
  return { ok: true as const };
}
