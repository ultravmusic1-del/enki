import type { Review } from "@/lib/schemas";

/**
 * Seeded editorial reviews.
 *
 * Deliberately empty. The 27 reviews previously here were written under six
 * invented bylines (see authors.ts). The same reasoning that already kept
 * `helpful` counts and `verified` flags out of this file — Enki cannot
 * substantiate them, and 16 CFR Part 465 prohibits inventing engagement
 * metrics for a monetized review site — applies at least as strongly to the
 * reviewers themselves.
 *
 * Real community reviews live in the Supabase `reviews` table and surface via
 * CommunityReviews / CommunityRatingSummary, which show approved reviews only.
 *
 * Add entries here only when a real person has genuinely reviewed the tool.
 */
export const reviews: Review[] = [];
