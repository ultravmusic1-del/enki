import { describe, it, expect } from "vitest";
import { pageMetadata } from "@/lib/metadata";

describe("pageMetadata", () => {
  const meta = pageMetadata({
    title: "Cursor vs Windsurf",
    description: "Two AI editors compared.",
    path: "/vs/cursor-vs-windsurf",
  });

  it("points canonical and og:url at the page, not the homepage", () => {
    expect(meta.alternates?.canonical).toBe("/vs/cursor-vs-windsurf");
    expect(meta.openGraph).toMatchObject({ url: "/vs/cursor-vs-windsurf" });
  });

  it("gives share tags the page's own title and description", () => {
    expect(meta.openGraph).toMatchObject({
      title: "Cursor vs Windsurf · Enki",
      description: "Two AI editors compared.",
    });
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Cursor vs Windsurf · Enki",
      description: "Two AI editors compared.",
    });
  });

  it("keeps the site card, which a page-level openGraph would otherwise drop", () => {
    const og = meta.openGraph as { images: { url: string }[] };
    expect(og.images[0].url).toBe("/opengraph-image");
  });

  it("lets article fields through without losing the type", () => {
    const article = pageMetadata({
      title: "A story",
      description: "What happened.",
      path: "/news/a-story",
      type: "article",
      openGraph: { publishedTime: "2026-09-26T10:00:00Z" },
    });
    expect(article.openGraph).toMatchObject({ type: "article", publishedTime: "2026-09-26T10:00:00Z" });
  });

  it("leaves images to a segment that has its own image files", () => {
    const tool = pageMetadata({ title: "Cursor", description: "d", path: "/tools/cursor", ownImage: true });
    expect(tool.openGraph).not.toHaveProperty("images");
    expect(tool.twitter).not.toHaveProperty("images");
  });
});
