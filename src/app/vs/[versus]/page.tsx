import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { ToolLogo } from "@/components/shared/tool-logo";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { Icon } from "@/components/shared/icon";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/structured-data";
import { getAllTools, getToolBySlug, getCategoryBySlug } from "@/lib/content";
import { parseVersusSlug, versusPairs, versusSlug } from "@/lib/seo";
import type { Tool } from "@/lib/schemas";

export async function generateStaticParams() {
  return versusPairs(await getAllTools()).map(([a, b]) => ({
    versus: versusSlug(a.slug, b.slug),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ versus: string }>;
}): Promise<Metadata> {
  const { versus } = await params;
  const parsed = parseVersusSlug(versus);
  if (!parsed) return { title: "Not found" };
  const a = await getToolBySlug(parsed[0]);
  const b = await getToolBySlug(parsed[1]);
  if (!a || !b) return { title: "Not found" };
  return {
    title: `${a.name} vs ${b.name}: which is better? (2026)`,
    description: `${a.name} vs ${b.name} compared on editor score, pricing, and features. My verdict on which AI tool to choose in 2026.`,
    alternates: { canonical: `/vs/${versusSlug(a.slug, b.slug)}` },
  };
}

export default async function VersusPage({
  params,
}: {
  params: Promise<{ versus: string }>;
}) {
  const { versus } = await params;
  const parsed = parseVersusSlug(versus);
  if (!parsed) notFound();
  const a = await getToolBySlug(parsed[0]);
  const b = await getToolBySlug(parsed[1]);
  if (!a || !b) notFound();

  const winner = a.editorScore >= b.editorScore ? a : b;
  const loser = winner === a ? b : a;
  const category = await getCategoryBySlug(a.categorySlug);

  const faqs = [
    {
      question: `Is ${a.name} better than ${b.name}?`,
      answer: `By my scoring, ${winner.name} edges ahead (${winner.editorScore.toFixed(1)} vs ${loser.editorScore.toFixed(1)} out of 10), but the right choice depends on your needs — ${loser.name} leads on ${loser.pros[0]?.toLowerCase() ?? "certain workflows"}.`,
    },
    {
      question: `How much do ${a.name} and ${b.name} cost?`,
      answer: `${a.name}: ${priceLine(a)}. ${b.name}: ${priceLine(b)}.`,
    },
  ];

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: `${a.name} vs ${b.name}`, path: `/vs/${versus}` },
          ]),
          faqJsonLd(faqs),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Head to head
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            {a.name} vs {b.name}
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Two {category?.name.toLowerCase() ?? "AI"} tools compared on my
            editor score, pricing, and the trade-offs that actually matter.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {[a, b].map((t) => (
            <div
              key={t.slug}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center ring-hairline"
            >
              <ToolLogo name={t.name} accent={t.accent} logo={t.logo} size="lg" />
              <Link
                href={`/tools/${t.slug}`}
                className="font-display text-xl font-semibold hover:text-teal"
              >
                {t.name}
              </Link>
              <span className="font-mono text-3xl font-semibold text-teal tabular-nums">
                {t.editorScore.toFixed(1)}
              </span>
              <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                Editor score
              </span>
              <PricingBadge model={t.pricing.model} />
            </div>
          ))}
        </div>

        {/* Attribute table */}
        <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
          <Row
            label="Editor score"
            a={`${a.editorScore.toFixed(1)} / 10`}
            b={`${b.editorScore.toFixed(1)} / 10`}
          />
          <Row label="Pricing" a={priceLine(a)} b={priceLine(b)} />
          <Row label="Best for" a={a.pros[0] ?? "—"} b={b.pros[0] ?? "—"} />
          <Row label="Watch out" a={a.cons[0] ?? "—"} b={b.cons[0] ?? "—"} />
        </div>

        {/* Verdict */}
        <div className="rounded-2xl border border-teal/20 bg-teal/5 p-6">
          <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-teal uppercase">
            <Icon name="BadgeCheck" className="size-4" />
            Enki verdict
          </p>
          <p className="mt-2 text-pretty">
            {winner.name} takes the edge with a {winner.editorScore.toFixed(1)}/10
            editor score. {winner.verdict} That said, {loser.name} is the better
            pick if {loser.pros[0]?.toLowerCase() ?? "its strengths"} matter most
            to you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
            <Link
              href={`/tools/${a.slug}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              {a.name} review
            </Link>
            <Link
              href={`/tools/${b.slug}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              {b.name} review
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-semibold">
            Frequently asked
          </h2>
          {faqs.map((f) => (
            <div
              key={f.question}
              className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline"
            >
              <h3 className="font-display text-base font-semibold">
                {f.question}
              </h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                {f.answer}
              </p>
            </div>
          ))}
        </section>
      </div>
    </Container>
  );
}

function priceLine(t: Tool): string {
  const model = t.pricing.model[0].toUpperCase() + t.pricing.model.slice(1);
  return t.pricing.startingPrice
    ? `${model}, from ${t.pricing.startingPrice}`
    : model;
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.2fr] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-pretty">{a}</span>
      <span className="text-pretty">{b}</span>
    </div>
  );
}
