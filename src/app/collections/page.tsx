import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { CollectionsManager } from "@/components/collections/collections-manager";
import { getAllTools } from "@/lib/content";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Group the AI tools you're evaluating into named collections, add private notes, and share a list with a link.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const tools = (await getAllTools()).map((t) => ({
    slug: t.slug,
    name: t.name,
    logo: t.logo,
    accent: t.accent,
  }));

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Your workspace
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            Collections
          </h1>
          <p className="text-pretty text-muted-foreground">
            Group tools into named lists — &ldquo;My writing stack&rdquo;,
            &ldquo;Evaluating for Q3&rdquo; — add private notes, and make a list
            public to share it with a link.
          </p>
        </header>

        <CollectionsManager tools={tools} />
      </div>
    </Container>
  );
}
