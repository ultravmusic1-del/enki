import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArticleBody, FounderSection } from "@/components/news/article-body";

const BODY = [
  "The lede, with a [source](https://techcrunch.com/a).",
  "",
  "<script>alert(1)</script> and [bad](javascript:alert(1))",
  "",
  "## What it means for founders",
  "- **Costs** fall.",
].join("\n");

describe("ArticleBody", () => {
  afterEach(cleanup);

  it("renders headings, lists and https links", () => {
    render(<ArticleBody body={BODY} />);
    expect(screen.getByRole("heading", { name: "What it means for founders" })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toBe("Costs fall.");
    const link = screen.getByRole("link", { name: "source" });
    expect(link.getAttribute("href")).toBe("https://techcrunch.com/a");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders HTML and unsafe links as inert text", () => {
    const { container } = render(<ArticleBody body={BODY} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("wraps the founder section in its own labelled section", () => {
    const { container } = render(<ArticleBody body={BODY} />);
    const section = container.querySelector("section[aria-labelledby]");
    expect(section?.textContent).toContain("Costs fall.");
    expect(section?.textContent).not.toContain("The lede");
  });

  it("can leave the founder section out of the body", () => {
    const { container } = render(<ArticleBody body={BODY} includeFounders={false} />);
    expect(container.textContent).toContain("The lede");
    expect(container.textContent).not.toContain("Costs fall.");
  });

  it("renders the founder section alone for the top of the page", () => {
    const { container } = render(<FounderSection body={BODY} />);
    expect(screen.getByRole("heading", { name: "What it means for founders" })).toBeTruthy();
    expect(container.textContent).not.toContain("The lede");
  });

  it("renders no founder section when the body has none", () => {
    const { container } = render(<FounderSection body="Just a lede." />);
    expect(container.innerHTML).toBe("");
  });
});
