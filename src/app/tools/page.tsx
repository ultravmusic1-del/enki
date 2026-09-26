import type { Metadata } from "next";
import { OracleHero } from "@/components/home/oracle-hero";
import { FeaturedToolCard } from "@/components/home/featured-tool-card";
import { CategoryTile } from "@/components/home/category-tile";
import { FinderCta } from "@/components/home/finder-cta";
import { DirectoryExplorer } from "@/components/directory/directory-explorer";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import { getAllTools, getCategories, getFeaturedTools, getStats } from "@/lib/content";
import { getAllTags } from "@/lib/filters";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "AI Tool Directory",
  description:
    "Browse and filter Enki's curated directory of human-vetted AI tools: search by name, use case, category, pricing, and rating.",
  path: "/tools",
});

const vetSteps = [
  {
    icon: "Telescope",
    title: "Discover",
    body: "I scan the fast-moving AI landscape continuously, tracking launches, updates, and the tools people actually reach for.",
  },
  {
    icon: "Eye",
    title: "Test",
    body: "Every tool here is one I have used in a real workflow, not judged from a landing page. I probe strengths, limits, and edge cases.",
  },
  {
    icon: "Scale",
    title: "Score",
    body: "I weigh capability, craft, pricing, and trust into a clear editor score, then pair it with real, human review context.",
  },
  {
    icon: "BadgeCheck",
    title: "Vet",
    body: "Only tools that earn it are published with my mark. When something slips, I revisit and revise. The oracle stays current.",
  },
] as const;

export default async function ToolsPage() {
  const [tools, categories, featuredAll, stats] = await Promise.all([
    getAllTools(),
    getCategories(),
    getFeaturedTools(),
    getStats(),
  ]);
  const tags = getAllTags(tools);
  const featured = featuredAll.slice(0, 6);
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      {/* The 3D scene chunk is what imports the model, so without this the .glb
          cannot even begin downloading until ~900KB of three.js has arrived and
          executed — measured at 9.7s to 14.8s on a throttled cold load. This
          overlaps the two instead of chaining them.

          `crossOrigin` is required, not optional. A preload only satisfies a
          later request when their modes match: `as="fetch"` without the
          attribute is a no-CORS preload, while three's FileLoader fetches in
          cors mode. Omitting it was measured downloading the model twice.
          React 19 hoists this into <head>. */}
      <link
        rel="preload"
        href="/models/enki-model.glb"
        as="fetch"
        type="model/gltf-binary"
        crossOrigin="anonymous"
      />

      <OracleHero toolCount={stats.toolCount} />

      <section id="directory" className="scroll-mt-24 py-16 sm:py-20">
        <Container>
          <header className="mb-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
              <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
              The directory
            </span>
            <h2 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
              Every tool, vetted
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              {tools.length} AI tools across {categories.length} categories. Search, filter, and
              sort to find the one worth your trust.
            </p>
          </header>

          <DirectoryExplorer tools={tools} categories={categories} tags={tags} />
        </Container>
      </section>

      {/* Featured tools */}
      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Editor's picks"
                title="Featured tools"
                description="The standouts I keep coming back to, tested, scored, and worth your attention."
              />
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

      {/* Guided finder CTA */}
      <FinderCta />

      {/* Categories */}
      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Browse by need"
              title="Explore every category"
              description="From writing to research to autonomous agents. Find the right class of tool, then the right tool within it."
              className="mx-auto max-w-2xl"
            />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, i) => (
              <Reveal key={category.slug} index={i} className="h-full">
                <CategoryTile category={category} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How we vet — with trust stats */}
      <section
        id="how-we-vet"
        className="relative scroll-mt-24 overflow-hidden py-16 sm:py-20"
      >
        {/* Centered bloom that fades to transparent well before the top/bottom
            edges, so the section blends seamlessly into its neighbors. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(62% 55% at 50% 50%, rgb(var(--glow) / 0.09), transparent 72%)",
          }}
        />
        <Container>
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Verify to trust"
              title="How I vet"
              description="Enki exists to make AI adoption trustworthy. Every listing passes through the same deliberate process."
              className="mx-auto max-w-2xl"
            />
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          {/* Trust stats reinforce the vetting story */}
          <Reveal>
            {/*
              Every cell here must be checkable. "Community reviews" and
              "Average rating" used to sit alongside these, summed from
              editorial sample figures while no user had written a review.
              "Tools listed" replaces "Tools vetted" because no tool currently
              carries a lastVetted date. Paid placements reads from the data,
              so it stays true the day that changes.
            */}
            <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border ring-hairline sm:grid-cols-3">
              <StatCell value={`${stats.toolCount}`} label="Tools listed" />
              <StatCell value={`${stats.categoryCount}`} label="Categories" />
              <StatCell
                value={stats.sponsoredCount === 0 ? "None" : `${stats.sponsoredCount}`}
                label="Paid placements"
              />
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-card px-4 py-7 text-center">
      <span className="font-display text-3xl font-semibold text-foreground tabular-nums sm:text-4xl">
        {value}
      </span>
      <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
