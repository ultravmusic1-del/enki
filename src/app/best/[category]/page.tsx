import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { RankedToolRow } from "@/components/seo/ranked-tool-row";
import { JsonLd } from "@/components/seo/json-ld";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from "@/lib/structured-data";
import {
  getCategories,
  getCategoryBySlug,
  getToolsByCategory,
} from "@/lib/content";
import type { Tool } from "@/lib/schemas";

const YEAR = 2026;

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ category: c.slug }));
}

async function ranked(slug: string): Promise<Tool[]> {
  return [...(await getToolsByCategory(slug))].sort(
    (a, b) =>
      b.editorScore - a.editorScore ||
      b.rating - a.rating ||
      b.reviewCount - a.reviewCount ||
      a.name.localeCompare(b.name),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) return { title: "Not found" };
  const tools = await ranked(category);
  return {
    title: `The ${tools.length} best ${cat.name} AI tools (${YEAR})`,
    description: `Our editors' ranked pick of the best ${cat.name.toLowerCase()} AI tools in ${YEAR}, vetted and scored. ${tools
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ")} and more.`,
    alternates: { canonical: `/best/${category}` },
  };
}

export default async function BestCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();

  const tools = await ranked(category);
  const top = tools[0];
  const freeTools = tools.filter(
    (t) => t.pricing.model === "free" || t.pricing.model === "freemium",
  );

  const noteFor = (rank: number, t: Tool) =>
    rank === 1
      ? `Our top ${cat.name.toLowerCase()} pick — editor score ${t.editorScore.toFixed(1)}/10. ${t.verdict}`
      : t.verdict;

  const faqs = [
    {
      question: `What is the best ${cat.name} AI tool in ${YEAR}?`,
      answer: `${top.name} is our top-rated ${cat.name.toLowerCase()} tool, with an editor score of ${top.editorScore.toFixed(1)}/10. ${top.verdict}`,
    },
    {
      question: `Are there free ${cat.name} AI tools?`,
      answer: freeTools.length
        ? `Yes — ${freeTools
            .slice(0, 3)
            .map((t) => t.name)
            .join(", ")} offer free or freemium plans.`
        : `Most tools in this category are paid, though several offer free trials.`,
    },
    {
      question: `How does Enki rank ${cat.name} tools?`,
      answer: `Each tool is used in real workflows by our editors and scored on capability, craft, pricing, and trust — independently of any commercial arrangement.`,
    },
  ];

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Best", path: "/best" },
            { name: cat.name, path: `/best/${category}` },
          ]),
          itemListJsonLd(
            tools.map((t) => ({ name: t.name, url: `/tools/${t.slug}` })),
          ),
          faqJsonLd(faqs),
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Best of {YEAR}
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            The {tools.length} best {cat.name} AI tools
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            {cat.description} Ranked by our editors, vetted and scored — updated
            for {YEAR}.
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <Link
              href={`/categories/${category}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              Browse all {cat.name}
            </Link>
            <Link
              href="/compare"
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              Compare tools
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {tools.map((t, i) => (
            <RankedToolRow
              key={t.slug}
              rank={i + 1}
              tool={t}
              note={noteFor(i + 1, t)}
            />
          ))}
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Frequently asked
          </h2>
          <div className="flex flex-col gap-3">
            {faqs.map((f) => (
              <div
                key={f.question}
                className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline"
              >
                <h3 className="flex items-start gap-2 font-display text-base font-semibold">
                  <Icon
                    name="MessagesSquare"
                    className="mt-0.5 size-4 shrink-0 text-teal"
                  />
                  {f.question}
                </h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">
                  {f.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}
