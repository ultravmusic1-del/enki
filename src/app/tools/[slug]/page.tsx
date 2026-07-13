import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { ToolLogo } from "@/components/shared/tool-logo";
import { StarRating } from "@/components/shared/star-rating";
import { PricingBadge } from "@/components/shared/pricing-badge";
import { ToolCard } from "@/components/shared/tool-card";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import { Badge } from "@/components/ui/badge";
import { ScreenshotCarousel } from "@/components/detail/screenshot-carousel";
import { RatingDistribution } from "@/components/detail/rating-distribution";
import { ReviewList } from "@/components/detail/review-list";
import { ReviewModal } from "@/components/detail/review-modal";
import {
  getAllTools,
  getToolBySlug,
  getCategoryBySlug,
  getRelatedTools,
  getReviewsForTool,
  getRatingDistribution,
} from "@/lib/content";

export function generateStaticParams() {
  return getAllTools().map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool not found" };

  return {
    title: `${tool.name} review: ${tool.tagline}`,
    description: tool.description,
    openGraph: {
      title: `${tool.name}, reviewed on Enki`,
      description: tool.description,
      type: "article",
    },
  };
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const category = getCategoryBySlug(tool.categorySlug);
  const reviews = getReviewsForTool(tool.slug);
  const related = getRelatedTools(tool, 3);
  const distribution = getRatingDistribution(tool.rating, tool.reviewCount);

  return (
    <article className="pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border pt-28 pb-12">
        <div className="spotlight pointer-events-none absolute inset-0 opacity-70" />
        <Container className="relative">
          <nav
            aria-label="Breadcrumb"
            className="mb-8 flex items-center gap-2 font-mono text-xs text-muted-foreground"
          >
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Icon name="ChevronRight" className="size-3" />
            <Link href="/tools" className="hover:text-foreground">
              Tools
            </Link>
            <Icon name="ChevronRight" className="size-3" />
            <span className="text-foreground">{tool.name}</span>
          </nav>

          {/* Identity */}
          <div className="flex max-w-3xl flex-col gap-5">
            <div className="flex items-start gap-4">
              <ToolLogo
                name={tool.name}
                accent={tool.accent}
                logo={tool.logo}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {category && (
                    <Link
                      href={`/categories/${category.slug}`}
                      className="font-mono text-xs tracking-wide text-teal uppercase hover:underline"
                    >
                      {category.name}
                    </Link>
                  )}
                  {tool.featured && (
                    <Badge className="gap-1 bg-teal/15 text-teal-bright">
                      <Icon name="Sparkles" className="size-3" />
                      Featured
                    </Badge>
                  )}
                </div>
                <h1 className="mt-1 font-display text-4xl leading-tight font-semibold sm:text-5xl">
                  {tool.name}
                </h1>
                <p className="mt-2 text-lg text-pretty text-muted-foreground">
                  {tool.tagline}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2">
                <StarRating value={tool.rating} size={16} />
                <span className="font-mono text-sm">
                  {tool.rating.toFixed(1)}
                  <span className="text-muted-foreground">
                    {" "}
                    ({tool.reviewCount.toLocaleString()} reviews)
                  </span>
                </span>
              </div>
              <PricingBadge model={tool.pricing.model} />
              {tool.pricing.startingPrice && (
                <span className="font-mono text-xs text-muted-foreground">
                  from {tool.pricing.startingPrice}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {tool.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tools?tags=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </div>

      <Container className="mt-12">
        {/* Screenshots */}
        <section>
          <SectionLabel icon="Image">Screenshots</SectionLabel>
          <ScreenshotCarousel
            screenshots={tool.screenshots}
            accent={tool.accent}
          />
        </section>

        {/* Editor score + actions */}
        <section className="mt-12">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 ring-hairline sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  Editor score
                </span>
                <span className="flex items-baseline gap-0.5">
                  <span className="font-display text-3xl font-semibold text-teal">
                    {tool.editorScore.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">/10</span>
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${tool.editorScore * 10}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={tool.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mist px-5 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow-sm"
              >
                Visit {tool.name}
                <Icon name="ExternalLink" className="size-3.5" />
              </a>
              <ReviewModal toolName={tool.name} />
            </div>
          </div>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_300px]">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-14">
            {/* Overview */}
            <section>
              <SectionLabel icon="BookOpen">Overview</SectionLabel>
              <p className="text-pretty text-muted-foreground">
                {tool.longDescription}
              </p>
              <div className="mt-6 rounded-2xl border border-teal/20 bg-teal/5 p-5">
                <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-teal uppercase">
                  <Icon name="BadgeCheck" className="size-4" />
                  Enki verdict
                </p>
                <p className="mt-2 text-pretty">{tool.verdict}</p>
              </div>
            </section>

            {/* Key features */}
            <section>
              <SectionLabel icon="Sparkles">Key features</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                {tool.keyFeatures.map((feature, i) => (
                  <Reveal key={feature.title} index={Math.min(i, 4)}>
                    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
                      <span className="grid size-10 place-items-center rounded-xl bg-teal/10 text-teal ring-1 ring-teal/20">
                        <Icon name={feature.icon} className="size-5" />
                      </span>
                      <h3 className="font-display text-base font-semibold">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-pretty text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* Pros & cons */}
            <section>
              <SectionLabel icon="Scale">Pros &amp; cons</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/60 p-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-teal">
                    <Icon name="CircleCheck" className="size-4" />
                    What we like
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {tool.pros.map((pro) => (
                      <li key={pro} className="flex gap-2 text-sm">
                        <Icon
                          name="Check"
                          className="mt-0.5 size-4 shrink-0 text-teal"
                        />
                        <span className="text-muted-foreground">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border bg-card/60 p-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon name="CircleX" className="size-4" />
                    Worth noting
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {tool.cons.map((con) => (
                      <li key={con} className="flex gap-2 text-sm">
                        <Icon
                          name="Minus"
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="text-muted-foreground">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Reviews */}
            <section id="reviews">
              <div className="flex items-center justify-between">
                <SectionLabel icon="MessagesSquare" className="mb-0">
                  Reviews
                </SectionLabel>
                <ReviewModal toolName={tool.name} />
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
                <RatingDistribution
                  rating={tool.rating}
                  reviewCount={tool.reviewCount}
                  distribution={distribution}
                />
              </div>
              <div className="mt-6">
                <ReviewList reviews={reviews} />
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <FactCard title="At a glance">
              <Fact label="Company" value={tool.company} />
              <Fact label="Founded" value={String(tool.foundedYear)} />
              <Fact
                label="Pricing"
                value={
                  tool.pricing.startingPrice
                    ? `${cap(tool.pricing.model)} · from ${tool.pricing.startingPrice}`
                    : cap(tool.pricing.model)
                }
              />
              {tool.pricing.hasFreeTrial && (
                <Fact label="Free trial" value="Yes" />
              )}
              {tool.pricing.note && (
                <p className="pt-1 text-xs text-muted-foreground">
                  {tool.pricing.note}
                </p>
              )}
            </FactCard>

            <FactCard title="Platforms">
              <div className="flex flex-wrap gap-2">
                {tool.platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </FactCard>

            {tool.integrations.length > 0 && (
              <FactCard title="Integrations">
                <div className="flex flex-wrap gap-2">
                  {tool.integrations.map((integration) => (
                    <span
                      key={integration}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {integration}
                    </span>
                  ))}
                </div>
              </FactCard>
            )}
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20">
            <SectionLabel icon="LayoutGrid">Related tools</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel, i) => (
                <Reveal key={rel.slug} index={i}>
                  <ToolCard tool={rel} className="h-full" />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </Container>
    </article>
  );
}

/* ---------------------------------------------------------------- helpers */

function SectionLabel({
  icon,
  children,
  className,
}: {
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`mb-6 flex items-center gap-2 font-display text-2xl font-semibold ${className ?? ""}`}
    >
      <Icon name={icon} className="size-5 text-teal" />
      {children}
    </h2>
  );
}

function FactCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 ring-hairline">
      <h3 className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
