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
