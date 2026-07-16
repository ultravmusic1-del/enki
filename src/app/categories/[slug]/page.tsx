import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { SavableToolCard } from "@/components/shared/savable-tool-card";
import { CategoryCard } from "@/components/shared/category-card";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import {
  getCategories,
  getCategoryBySlug,
  getToolsByCategory,
} from "@/lib/content";
import { sortTools } from "@/lib/filters";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: `${category.name}: AI tools`,
    description: category.description,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const tools = sortTools(getToolsByCategory(category.slug), "rating");
  const otherCategories = getCategories()
    .filter((c) => c.slug !== category.slug)
    .slice(0, 3);

  return (
    <div className="pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden pt-28 pb-14">
        <div className="spotlight pointer-events-none absolute inset-0 opacity-70" />
        {/* Dissolve the masthead into the page: a soft, center-weighted hairline
            that fades to transparent at both edges, replacing the hard full-width
            rule that used to hard-cut the flow into the content below. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        />
        <Container className="relative">
          <nav
            aria-label="Breadcrumb"
            className="mb-8 flex items-center gap-2 font-mono text-xs text-muted-foreground"
          >
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Icon name="ChevronRight" className="size-3" />
            <Link href="/categories" className="hover:text-foreground">
              Categories
            </Link>
            <Icon name="ChevronRight" className="size-3" />
            <span className="text-foreground">{category.name}</span>
          </nav>

          <div className="flex items-start gap-5">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-2xl ring-hairline"
              style={{
                color: category.accent,
                background: `linear-gradient(150deg, ${category.accent}22, transparent)`,
                boxShadow: `inset 0 0 0 1px ${category.accent}2a, 0 0 40px -12px ${category.accent}`,
              }}
            >
              <Icon name={category.icon} className="size-7" />
            </span>
            <div>
              <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
                {category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-lg text-pretty text-muted-foreground">
                {category.description}
              </p>
              <p className="mt-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                {category.toolCount}{" "}
                {category.toolCount === 1 ? "tool" : "tools"} vetted
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="mt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <Reveal key={tool.slug} index={Math.min(i, 6)}>
              <SavableToolCard tool={tool} categoryName={category.name} />
            </Reveal>
          ))}
        </div>

        {/* Other categories */}
        <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">
              Other categories
            </h2>
            <Link
              href="/categories"
              className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <Icon
                name="ArrowRight"
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCategories.map((c) => (
              <CategoryCard key={c.slug} category={c} />
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}
