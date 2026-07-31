import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { ToolLogo } from "@/components/shared/tool-logo";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";
import { JsonLd } from "@/components/seo/json-ld";
import { itemListJsonLd } from "@/lib/structured-data";
import { getActiveDeals } from "@/lib/deals";
import { getAllTools } from "@/lib/content";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";

export const metadata: Metadata = {
  title: "AI tool deals & discounts (2026)",
  description:
    "Live discounts and coupon codes on the best AI tools, vetted by Enki. Save on the tools worth your trust.",
  alternates: { canonical: "/deals" },
};

export default async function DealsPage() {
  const deals = getActiveDeals(await getAllTools(), new Date());

  return (
    <Container className="pt-28 pb-20">
      {deals.length > 0 && (
        <JsonLd
          data={itemListJsonLd(
            deals.map((t) => ({ name: t.name, url: `/tools/${t.slug}` })),
          )}
        />
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-amber-300 uppercase">
            Deals
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            AI tool deals &amp; discounts
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-lg text-muted-foreground">
            Current offers on the tools I actually recommend — no
            filler, and never at the expense of an honest rating.
          </p>
        </header>

        {deals.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-10 text-center ring-hairline">
            <span
              className="emblem size-10 opacity-50"
              style={{ color: "var(--brand-teal)" }}
              aria-hidden
            />
            <p className="font-display text-lg font-semibold">
              No active deals right now
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              We only list deals we can stand behind. Check back soon, or browse
              the full directory in the meantime.
            </p>
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
            >
              Browse all tools
              <Icon name="ArrowRight" className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {deals.map((tool) => {
              const outbound = resolveOutboundTarget(tool);
              return (
                <div
                  key={tool.slug}
                  className="flex flex-col gap-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-5 ring-hairline sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ToolLogo
                      name={tool.name}
                      accent={tool.accent}
                      logo={tool.logo}
                      size="md"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="font-display text-lg font-semibold hover:text-teal"
                      >
                        {tool.name}
                      </Link>
                      <p className="text-sm text-pretty text-amber-200">
                        {tool.deal.headline}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <PricingBadge model={tool.pricing.model} />
                    <a
                      href={outboundHref(tool.slug)}
                      target="_blank"
                      rel={
                        outbound.isAffiliate
                          ? "sponsored noopener noreferrer"
                          : "noopener noreferrer"
                      }
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-semibold whitespace-nowrap text-[#2a1a00] transition-colors hover:bg-amber-300"
                    >
                      Claim
                      <Icon name="ArrowUpRight" className="size-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Container>
  );
}
