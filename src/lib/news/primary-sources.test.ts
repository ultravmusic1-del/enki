import { describe, it, expect } from "vitest";
import { isPrimaryUrl, primaryLinksInBody, splitSources } from "@/lib/news/primary-sources";

describe("isPrimaryUrl", () => {
  it("recognises companies, labs, papers and governments, with subdomains", () => {
    for (const url of [
      "https://openai.com/index/x",
      "https://www.anthropic.com/news/y",
      "https://blog.google/technology/ai/z",
      "https://arxiv.org/abs/2609.00001",
      "https://www.health.gov.au/news",
      "https://www.sec.gov/filing",
      "https://digital-strategy.ec.europa.eu/en/policies",
    ]) {
      expect(isPrimaryUrl(url), url).toBe(true);
    }
  });
  it("treats news outlets and look-alike hosts as reporting", () => {
    for (const url of [
      "https://www.theverge.com/story",
      "https://techcrunch.com/2026/09/23/x",
      "https://notopenai.com/",
      "https://openai.com.evil.example/",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(isPrimaryUrl(url), url).toBe(false);
    }
  });
});

describe("primaryLinksInBody", () => {
  it("finds primary links in paragraphs and lists, once each, in reading order", () => {
    const body = [
      "OpenAI [announced it](https://openai.com/index/a), [The Verge reported](https://www.theverge.com/b).",
      "",
      "- See [the paper](https://arxiv.org/abs/1) and [the post](https://openai.com/index/a).",
    ].join("\n");
    expect(primaryLinksInBody(body)).toEqual([
      { name: "announced it", url: "https://openai.com/index/a" },
      { name: "the paper", url: "https://arxiv.org/abs/1" },
    ]);
    expect(primaryLinksInBody(null)).toEqual([]);
  });
});

describe("splitSources", () => {
  it("lists primary sources first and keeps outlets as reporting", () => {
    const sources = [
      { name: "The Verge", url: "https://www.theverge.com/a" },
      { name: "Google AI", url: "https://blog.google/technology/ai/b" },
    ];
    const body = "Google [said so](https://blog.google/technology/ai/b) and [Nature](https://www.nature.com/c).";
    const { primary, reporting } = splitSources(sources, body);
    expect(primary).toEqual([
      { name: "Google AI", url: "https://blog.google/technology/ai/b" },
      { name: "Nature", url: "https://www.nature.com/c" },
    ]);
    expect(reporting.map((r) => r.name)).toEqual(["The Verge"]);
  });
});
