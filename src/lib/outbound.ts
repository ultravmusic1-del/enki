import type { Tool } from "@/lib/schemas";

/** Internal tracked-redirect path for a tool slug. */
export function outboundHref(slug: string): string {
  return `/go/${slug}`;
}

export type OutboundTarget = {
  /** Final external destination. */
  url: string;
  /** True when an affiliate URL was used (drives rel="sponsored"). */
  isAffiliate: boolean;
};

/** Resolve where a tool's outbound link should ultimately go. */
export function resolveOutboundTarget(
  tool: Pick<Tool, "website" | "affiliateUrl">,
): OutboundTarget {
  if (tool.affiliateUrl) {
    return { url: tool.affiliateUrl, isAffiliate: true };
  }
  return { url: tool.website, isAffiliate: false };
}
