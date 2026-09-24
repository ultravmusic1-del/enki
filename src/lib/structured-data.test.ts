import { describe, it, expect, beforeAll } from "vitest";
import {
  siteJsonLd,
  toolJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
  newsArticleJsonLd,
} from "@/lib/structured-data";
import { getToolBySlug } from "@/lib/content";
import type { Tool } from "@/lib/schemas";

type Node = { "@type"?: string; [k: string]: unknown };

function graphOf(data: unknown): Node[] {
  return (data as { "@graph": Node[] })["@graph"];
}
function nodeOfType(nodes: Node[], type: string): Node {
  const n = nodes.find((x) => x["@type"] === type);
  if (!n) throw new Error(`no ${type} node`);
  return n;
}

describe("structured-data: site", () => {
  it("emits an Organization and a WebSite with a search action", () => {
    const data = siteJsonLd() as { "@context": string };
    expect(data["@context"]).toBe("https://schema.org");
    const graph = graphOf(data);
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(nodeOfType(graph, "WebSite").potentialAction).toBeTruthy();
  });
});

describe("structured-data: tool", () => {
  let tool: Tool;
  let graph: Node[];
  beforeAll(async () => {
    tool = (await getToolBySlug("cursor"))!;
    graph = graphOf(toolJsonLd({ tool, categoryName: "Coding & Dev" }));
  });

  it("omits AggregateRating: there is no rating to claim", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.aggregateRating).toBeUndefined();
  });

  it("omits embedded Review markup: there are no reviews to claim", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.review).toBeUndefined();
  });

  it("still describes the application itself", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.name).toBe(tool.name);
    expect(String(app.url)).toContain("/tools/cursor");
  });

  it("prices a freemium tool at zero", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    const offer = app.offers as { price: string } | undefined;
    expect(offer?.price).toBe("0");
  });

  it("emits a 3-item breadcrumb ending at the tool", () => {
    const crumb = nodeOfType(graph, "BreadcrumbList");
    const items = crumb.itemListElement as Array<{ name: string }>;
    expect(items).toHaveLength(3);
    expect(items[2].name).toBe(tool.name);
  });
});

describe("structured-data: reusable page builders", () => {
  it("builds an ItemList with absolute URLs and 1-based positions", () => {
    const ld = itemListJsonLd([
      { name: "A", url: "/tools/a" },
      { name: "B", url: "/tools/b" },
    ]);
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0]).toMatchObject({ position: 1, name: "A" });
    expect(ld.itemListElement[0].url).toMatch(/^https?:\/\/.+\/tools\/a$/);
  });

  it("builds a FAQPage from Q/A pairs", () => {
    const ld = faqJsonLd([{ question: "Q?", answer: "A." }]);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity[0]).toMatchObject({ "@type": "Question", name: "Q?" });
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });

  it("builds a BreadcrumbList with absolute item URLs", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Best", path: "/best/writing" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, name: "Best" });
    expect(ld.itemListElement[1].item).toMatch(/\/best\/writing$/);
  });
});

describe("newsArticleJsonLd", () => {
  const story = {
    id: "id-1",
    slug: "gemini-hacked-31fc2b",
    headline: "H".repeat(140),
    summary: "A summary.",
    take: "t".repeat(300),
    body: "word ".repeat(400),
    bodyWords: 400,
    beat: "policy-safety" as const,
    beatName: "Policy & Safety",
    imageUrl: null,
    sourceName: "The Verge",
    sourceSiteUrl: "https://www.theverge.com",
    sourceUrl: "https://www.theverge.com/story",
    sourcePublishedAt: "2026-09-19T15:25:00Z",
    publishedAt: "2026-09-21T10:01:35Z",
    featured: false,
    takeaway: null,
  };

  const sources = [
    { name: "The Verge", siteUrl: "https://www.theverge.com", url: "https://www.theverge.com/story" },
    { name: "Ars Technica", siteUrl: "https://arstechnica.com", url: "https://arstechnica.com/story" },
  ];

  it("describes the story as a NewsArticle at its absolute URL", () => {
    const ld = newsArticleJsonLd(story, sources) as Record<string, unknown>;
    expect(ld["@type"]).toBe("NewsArticle");
    expect(String(ld.url)).toMatch(/^https?:\/\/.+\/news\/gemini-hacked-31fc2b$/);
    expect(ld.isBasedOn).toEqual(sources.map((s) => s.url));
    expect(ld.wordCount).toBe(400);
    expect(ld.datePublished).toBe(story.publishedAt);
    expect(ld.dateModified).toBe(story.publishedAt);
  });

  it("dates a corrected story's modification to its last correction", () => {
    const ld = newsArticleJsonLd(story, sources, "2026-09-22T08:00:00Z") as Record<string, unknown>;
    expect(ld.dateModified).toBe("2026-09-22T08:00:00Z");
  });

  it("truncates the headline to the 110 characters search engines accept", () => {
    const ld = newsArticleJsonLd(story, sources) as { headline: string };
    expect(ld.headline.length).toBeLessThanOrEqual(110);
  });

  it("omits the image when the story has none", () => {
    expect(newsArticleJsonLd(story, sources)).not.toHaveProperty("image");
  });
});
