import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { CategoryCard } from "@/components/shared/category-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { getCategories, getStats } from "@/lib/content";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse Enki's AI tools by category: writing, image, coding, productivity, video, audio, research, and marketing.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesPage() {
  const categories = getCategories();
  const stats = getStats();

  return (
    <div className="pt-28 pb-16">
      <Container>
        <header className="mb-12 max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            Browse by need
          </span>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
            Categories
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            {stats.toolCount} vetted tools organized into {stats.categoryCount}{" "}
            categories. Start with the class of tool you need, then find the one
            worth trusting.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, i) => (
            <Reveal key={category.slug} index={Math.min(i, 6)}>
              <CategoryCard category={category} className="h-full" />
            </Reveal>
          ))}
        </div>

        <div className="mt-16">
          <SectionHeading
            align="center"
            eyebrow="Prefer to search?"
            title="Explore the full directory"
            description="Jump straight into every tool with search, filters, and sort."
            className="mx-auto max-w-xl"
          />
          <div className="mt-6 flex justify-center">
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 rounded-full bg-mist px-6 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow"
            >
              Browse all tools
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
