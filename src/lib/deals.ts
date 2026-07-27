import type { Deal, Tool } from "@/lib/schemas";

/* =========================================================================
   Deals & coupons. A tool may carry an optional `deal`; these helpers decide
   whether it is currently live and collect the active ones for the /deals
   roundup. Pure and deterministic — the caller passes `now` so rendering stays
   testable and SSG-stable.
   ========================================================================= */

/** A deal is live if it has no expiry, or its expiry is today or later. */
export function isDealActive(
  deal: Deal | undefined,
  now: Date,
): deal is Deal {
  if (!deal) return false;
  if (!deal.expiresAt) return true;
  const expires = new Date(`${deal.expiresAt}T23:59:59Z`);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() >= now.getTime();
}

export type ToolWithDeal = Tool & { deal: Deal };

/** Tools with a currently-live deal, most editorially-endorsed first. */
export function getActiveDeals(tools: Tool[], now: Date): ToolWithDeal[] {
  return tools
    .filter((t): t is ToolWithDeal => isDealActive(t.deal, now))
    .sort(
      (a, b) => b.editorScore - a.editorScore || a.name.localeCompare(b.name),
    );
}
