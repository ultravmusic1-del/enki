/* =========================================================================
   Content freshness / re-vetting.

   AI tools change weekly, so a listing silently rots. `lastVetted` records
   when an editor last checked a tool; these helpers turn that into a public
   trust signal and an operator work-queue. A tool with no date is "never"
   vetted — surfaced first, since it needs attention most.
   ========================================================================= */

/** A listing older than this many days is considered stale. */
export const STALE_AFTER_DAYS = 90;

export type VettingState = "fresh" | "stale" | "never";

export type VettingStatus = {
  state: VettingState;
  /** Whole days since the last vetting; null when never vetted. */
  daysAgo: number | null;
};

const MS_PER_DAY = 86_400_000;

/** Classify a tool's vetting recency. `lastVetted` is an ISO date (YYYY-MM-DD). */
export function vettingStatus(
  lastVetted: string | undefined,
  now: Date,
  staleAfterDays: number = STALE_AFTER_DAYS,
): VettingStatus {
  if (!lastVetted) return { state: "never", daysAgo: null };

  const vettedAt = new Date(`${lastVetted}T00:00:00Z`);
  if (Number.isNaN(vettedAt.getTime())) return { state: "never", daysAgo: null };

  const daysAgo = Math.floor((now.getTime() - vettedAt.getTime()) / MS_PER_DAY);
  return { state: daysAgo > staleAfterDays ? "stale" : "fresh", daysAgo };
}

export type RevetEntry<T> = { tool: T; status: VettingStatus };

/**
 * Tools that need re-vetting, most urgent first: never-vetted before stale,
 * then longest-overdue. Fresh tools are omitted. Pure; never mutates input.
 */
export function toolsNeedingRevet<T extends { lastVetted?: string }>(
  tools: T[],
  now: Date,
  staleAfterDays: number = STALE_AFTER_DAYS,
): RevetEntry<T>[] {
  return tools
    .map((tool) => ({
      tool,
      status: vettingStatus(tool.lastVetted, now, staleAfterDays),
    }))
    .filter((entry) => entry.status.state !== "fresh")
    .sort((a, b) => {
      if (a.status.state !== b.status.state) {
        return a.status.state === "never" ? -1 : 1;
      }
      return (b.status.daysAgo ?? 0) - (a.status.daysAgo ?? 0);
    });
}
