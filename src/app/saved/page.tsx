import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { SavedGallery, type SavedItem } from "@/components/saved/saved-gallery";
import { getAllTools, getCategories } from "@/lib/content";

export const metadata: Metadata = {
  title: "Saved tools",
  description: "Your shortlist of AI tools, saved for quick access on Enki.",
  alternates: { canonical: "/saved" },
};

export default function SavedPage() {
  const categoryName = new Map(getCategories().map((c) => [c.slug, c.name]));
  const items: SavedItem[] = getAllTools().map((tool) => ({
    tool,
    categoryName: categoryName.get(tool.categorySlug) ?? "",
  }));

  return (
    <div className="pt-28 pb-24">
      <Container>
        <header className="max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            Your shortlist
          </span>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
            Saved tools
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            The tools you&apos;ve bookmarked, kept on this device. Nothing to
            sign up for — save what interests you and pick up where you left off.
          </p>
        </header>

        <SavedGallery items={items} />
      </Container>
    </div>
  );
}
