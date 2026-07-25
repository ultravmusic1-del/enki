import { describe, it, expect, beforeAll } from "vitest";
import {
  siteJsonLd,
  toolJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from "@/lib/structured-data";
import { getToolBySlug, getReviewsForTool } from "@/lib/content";
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
    const reviews = getReviewsForTool("cursor");
    graph = graphOf(toolJsonLd({ tool, categoryName: "Coding & Dev", reviews }));
  });

  it("emits a SoftwareApplication whose rating mirrors the tool", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    const agg = app.aggregateRating as {
      ratingValue: number;
      reviewCount: number;
    };
    expect(agg.ratingValue).toBe(tool.rating);
    expect(agg.reviewCount).toBe(tool.reviewCount);
    expect(String(app.url)).toContain("/tools/cursor");
  });

  it("caps embedded reviews at five", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect((app.review as unknown[]).length).toBeLessThanOrEqual(5);
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
