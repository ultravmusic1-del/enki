import { describe, it, expect } from "vitest";
import { siteJsonLd, toolJsonLd } from "@/lib/structured-data";
import { getToolBySlug, getReviewsForTool } from "@/lib/content";

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
  const tool = getToolBySlug("cursor")!;
  const reviews = getReviewsForTool("cursor");
  const graph = graphOf(
    toolJsonLd({ tool, categoryName: "Coding & Dev", reviews }),
  );

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
