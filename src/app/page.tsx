import Link from "next/link";
import { OracleHero } from "@/components/home/oracle-hero";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FeaturedToolCard } from "@/components/home/featured-tool-card";
import { CategoryTile } from "@/components/home/category-tile";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import { getFeaturedTools, getCategories, getStats } from "@/lib/content";

const vetSteps = [
  {
    icon: "Telescope",
    title: "Discover",
    body: "We scan the fast-moving AI landscape continuously, tracking launches, updates, and the tools people actually reach for.",
  },
  {
    icon: "Eye",
    title: "Test",
    body: "Every tool is used in real workflows by our editors — not judged from a landing page. We probe strengths, limits, and edge cases.",
  },
  {
    icon: "Scale",
    title: "Score",
    body: "We weigh capability, craft, pricing, and trust into a clear editor score, then pair it with real, human review context.",
  },
  {
    icon: "BadgeCheck",
    title: "Vet",
    body: "Only tools that earn it are published with our mark. When something slips, we revisit and revise — the oracle stays current.",
  },
] as const;

export default function Home() {
  const featured = getFeaturedTools().slice(0, 6);
  const categories = getCategories();
  const stats = getStats();
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      <OracleHero stats={stats} />

      {/* Featured tools */}
      <section className="py-16 sm:py-24">
        <Container>
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Editor's picks"
                title="Featured tools"
                description="The standouts our editors keep coming back to — vetted, scored, and worth your attention."
              />
              <Link
                href="/tools"
                className="group inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
              >
                View all tools
                <Icon
                  name="ArrowRight"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tool, i) => (
              <Reveal key={tool.slug} index={i} className="h-full">
                <FeaturedToolCard
                  tool={tool}
                  categoryName={categoryName.get(tool.categorySlug)}
                />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Categories */}
      <section className="py-16 sm:py-24">
        <Container>
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Browse by need"
              title="Explore every category"
              description="From writing to research to autonomous agents — find the right class of tool, then the right tool within it."
              className="mx-auto max-w-2xl"
            />
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, i) => (
              <Reveal key={category.slug} index={i} className="h-full">
                <CategoryTile category={category} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How we vet */}
      <section
        id="how-we-vet"
        className="relative scroll-mt-24 overflow-hidden py-16 sm:py-28"
      >
        <div className="spotlight pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <Container>
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Verify to trust"
              title="How we vet"
              description="Enki exists to make AI adoption trustworthy. Every listing passes through the same deliberate process."
              className="mx-auto max-w-2xl"
            />
          </Reveal>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {vetSteps.map((step, i) => (
              <Reveal key={step.title} index={i}>
                <div className="group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/60 p-6 ring-hairline transition-colors hover:border-teal/40">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-teal/10 text-teal ring-1 ring-teal/20">
                      <Icon name={step.icon} className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Stats band */}
      <section className="py-10">
        <Container>
          <Reveal>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border ring-hairline md:grid-cols-4">
              <StatCell value={`${stats.toolCount}`} label="Tools vetted" />
              <StatCell value={`${stats.categoryCount}`} label="Categories" />
              <StatCell
                value={`${stats.reviewCount.toLocaleString()}`}
                label="Community reviews"
              />
              <StatCell
                value={`${stats.averageRating.toFixed(1)}`}
                label="Average rating"
              />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center ring-hairline sm:px-16">
              <div className="spotlight pointer-events-none absolute inset-0 opacity-90" />
              <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
                <span
                  className="emblem mb-6 size-14"
                  style={{
                    color: "var(--brand-teal)",
                    filter: "drop-shadow(0 0 24px rgb(var(--glow) / 0.5))",
                  }}
                  aria-hidden
                />
                <h2 className="text-balance text-3xl font-semibold sm:text-4xl">
                  Find the AI tools worth trusting
                </h2>
                <p className="mt-4 text-pretty text-muted-foreground">
                  Skip the hype cycle. Enki does the vetting so you can adopt
                  with confidence.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/tools"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mist px-6 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow"
                  >
                    Explore the directory
                    <Icon name="ArrowRight" className="size-4" />
                  </Link>
                  <Link
                    href="/categories"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                  >
                    Browse categories
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-card px-4 py-8 text-center">
      <span className="font-display text-3xl font-semibold text-foreground tabular-nums sm:text-4xl">
        {value}
      </span>
      <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
