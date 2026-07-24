import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { RankedToolRow } from "@/components/seo/ranked-tool-row";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/structured-data";
import {
  getAllTools,
  getToolBySlug,
  getRelatedTools,
  getCategoryBySlug,
} from "@/lib/content";

export function generateStaticParams() {
  return getAllTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Not found" };
  const alts = getRelatedTools(tool, 6);
  return {
    title: `${alts.length} best ${tool.name} alternatives (2026)`,
    description: `Looking for an alternative to ${tool.name}? Our editors' vetted picks: ${alts
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ")} and more.`,
    alternates: { canonical: `/alternatives/${slug}` },
  };
}

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const alts = getRelatedTools(tool, 6);
  const category = getCategoryBySlug(tool.categorySlug);

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: tool.name, path: `/tools/${tool.slug}` },
            { name: "Alternatives", path: `/alternatives/${slug}` },
          ]),
          itemListJsonLd(
            alts.map((t) => ({ name: t.name, url: `/tools/${t.slug}` })),
          ),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Alternatives
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            The best {tool.name} alternatives
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            {tool.name} is a strong {category?.name.toLowerCase() ?? "AI"} tool,
            but it isn&apos;t the only option. Here are the vetted alternatives
            our editors rate most highly.
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <Link
              href={`/tools/${tool.slug}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              Read our {tool.name} review
            </Link>
            {category && (
              <Link
                href={`/best/${category.slug}`}
                className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
              >
                Best {category.name}
              </Link>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {alts.map((t, i) => (
            <RankedToolRow
              key={t.slug}
              rank={i + 1}
              tool={t}
              note={
                t.categorySlug === tool.categorySlug
                  ? `A direct ${category?.name.toLowerCase() ?? ""} alternative. ${t.verdict}`
                  : t.verdict
              }
            />
          ))}
        </div>

        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Icon name="Scale" className="size-4 text-teal" />
          Compare any of these head-to-head on the{" "}
          <Link href="/compare" className="text-teal hover:underline">
            compare page
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
