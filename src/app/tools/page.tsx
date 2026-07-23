import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { DirectoryExplorer } from "@/components/directory/directory-explorer";
import { getAllTools, getCategories } from "@/lib/content";
import { getAllTags } from "@/lib/filters";

export const metadata: Metadata = {
  title: "AI Tool Directory",
  description:
    "Browse and filter Enki's curated directory of human-vetted AI tools: search by name, use case, category, pricing, and rating.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  const tools = getAllTools();
  const categories = getCategories();
  const tags = getAllTags(tools);

  return (
    <div className="pt-28 pb-16">
      <Container>
        <header className="mb-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            The directory
          </span>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
            Every tool, vetted
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            {tools.length} AI tools across {categories.length} categories.
            Search, filter, and sort to find the one worth your trust.
          </p>
        </header>

        <Suspense fallback={<DirectorySkeleton />}>
          <DirectoryExplorer
            tools={tools}
            categories={categories}
            tags={tags}
          />
        </Suspense>
      </Container>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <div className="hidden lg:block">
        <div className="h-96 rounded-2xl border border-border bg-card/40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-44 rounded-2xl border border-border bg-card/40"
          />
        ))}
      </div>
    </div>
  );
}
