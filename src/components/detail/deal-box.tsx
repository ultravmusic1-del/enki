import type { Tool } from "@/lib/schemas";
import { isDealActive } from "@/lib/deals";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";
import { Icon } from "@/components/shared/icon";

/**
 * A prominent, expiry-aware deal callout on the tool page. The CTA routes
 * through the tracked /go redirect (attributed like any outbound click) and
 * carries rel="sponsored" when the destination is an affiliate URL.
 */
export function DealBox({ tool }: { tool: Tool }) {
  if (!isDealActive(tool.deal, new Date())) return null;
  const deal = tool.deal;
  const outbound = resolveOutboundTarget(tool);

  const expiresLabel = deal.expiresAt
    ? new Date(`${deal.expiresAt}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <section className="mt-12 rounded-3xl border border-amber-400/30 bg-amber-400/[0.06] p-6 ring-hairline sm:p-8">
      <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-amber-300 uppercase">
        <Icon name="Tag" className="size-4" />
        Deal
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-pretty sm:text-3xl">
        {deal.headline}
      </h2>
      {deal.detail && (
        <p className="mt-2 text-pretty text-muted-foreground">{deal.detail}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={outboundHref(tool.slug)}
          target="_blank"
          rel={
            outbound.isAffiliate
              ? "sponsored noopener noreferrer"
              : "noopener noreferrer"
          }
          className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-sm font-semibold whitespace-nowrap text-[#2a1a00] transition-all hover:-translate-y-0.5 hover:bg-amber-300"
        >
          Claim deal at {tool.name}
          <Icon
            name="ArrowUpRight"
            className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </a>
        {deal.code && (
          <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-amber-400/50 px-4 py-2 font-mono text-sm text-amber-200">
            <span className="text-[0.65rem] tracking-wide text-amber-300/70 uppercase">
              Code
            </span>
            {deal.code}
          </span>
        )}
      </div>

      {expiresLabel && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Ends {expiresLabel}
        </p>
      )}
    </section>
  );
}
