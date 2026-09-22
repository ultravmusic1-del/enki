import { describe, it, expect } from "vitest";
import { parseArticleBody, parseInline, splitFounderSection } from "@/lib/news/article-body";

describe("parseInline", () => {
  it("reads bold and https links between plain text", () => {
    expect(parseInline("A **big** move, per [Ars](https://arstechnica.com/x).")).toEqual([
      { type: "text", text: "A " },
      { type: "bold", text: "big" },
      { type: "text", text: " move, per " },
      { type: "link", text: "Ars", href: "https://arstechnica.com/x" },
      { type: "text", text: "." },
    ]);
  });

  it("leaves non-https links as literal text", () => {
    expect(parseInline("[x](javascript:alert(1)) and [y](http://a.b)")).toEqual([
      { type: "text", text: "[x](javascript:alert(1)) and [y](http://a.b)" },
    ]);
  });

  it("leaves raw HTML as literal text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { type: "text", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("parseArticleBody", () => {
  it("builds paragraphs, headings and lists", () => {
    const blocks = parseArticleBody(
      "First line\nstill first.\n\n## What it means for founders\n- one\n- **two**\n\nLast.",
    );
    expect(blocks).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "First line still first." }] },
      { type: "heading", text: "What it means for founders" },
      {
        type: "list",
        items: [[{ type: "text", text: "one" }], [{ type: "bold", text: "two" }]],
      },
      { type: "paragraph", inlines: [{ type: "text", text: "Last." }] },
    ]);
  });

  it("treats other Markdown as plain text", () => {
    expect(parseArticleBody("# Big\n> quote")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "# Big > quote" }] },
    ]);
  });

  it("handles Windows line endings and an empty body", () => {
    expect(parseArticleBody("a\r\n\r\nb")).toHaveLength(2);
    expect(parseArticleBody("   ")).toEqual([]);
  });
});

describe("splitFounderSection", () => {
  it("splits at the founder heading", () => {
    const blocks = parseArticleBody("Lede.\n\n## What it means for founders\n- one");
    const { main, founders } = splitFounderSection(blocks);
    expect(main).toHaveLength(1);
    expect(founders?.[0]).toEqual({ type: "heading", text: "What it means for founders" });
    expect(founders).toHaveLength(2);
  });

  it("returns null founders when there is no heading", () => {
    expect(splitFounderSection(parseArticleBody("Just text.")).founders).toBeNull();
  });
});
