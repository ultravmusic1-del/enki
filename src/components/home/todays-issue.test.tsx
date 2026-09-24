import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TodaysIssue } from "@/components/home/todays-issue";
import type { Issue } from "@/lib/news/issue";

const ISSUE: Issue = {
  dateLabel: "Wed 23 Sep",
  totalCount: 4,
  minutes: 8,
  lead: { slug: "gemini", headline: "Gemini", founderMarkdown: null },
  stories: [
    { slug: "gemini", headline: "Gemini hacked three companies", beat: "policy-safety", beatName: "Policy & Safety", outlets: ["The Verge", "Ars Technica"], takeaway: "Scan your repos.", imageUrl: "https://img.example/gemini.jpg" },
    { slug: "muse", headline: "Amazon blocks Muse", beat: "products-launches", beatName: "Products & Launches", outlets: ["TechCrunch"], takeaway: "Plan for platforms saying no.", imageUrl: null },
  ],
};

describe("TodaysIssue", () => {
  afterEach(cleanup);

  it("renders nothing without an issue", () => {
    const { container } = render(<TodaysIssue issue={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("numbers the stories and links each one", () => {
    render(<TodaysIssue issue={ISSUE} />);
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("02")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gemini hacked three companies/ }).getAttribute("href")).toBe("/news/gemini");
  });

  it("shows takeaways, outlets, the masthead and the remaining count", () => {
    render(<TodaysIssue issue={ISSUE} />);
    expect(screen.getByText("Scan your repos.")).toBeTruthy();
    // Outlets render twice by design (a row on mobile, a column on desktop).
    expect(screen.getAllByText("Ars Technica").length).toBeGreaterThan(0);
    expect(screen.getByText("Wed 23 Sep · 4 stories · 8 min")).toBeTruthy();
    expect(screen.getByText("And 2 more stories in today's brief.")).toBeTruthy();
  });

  it("omits the remaining count when every story is shown", () => {
    render(<TodaysIssue issue={{ ...ISSUE, totalCount: 2 }} />);
    expect(screen.queryByText(/more stor/)).toBeNull();
  });

  it("shows each story's image, or the placeholder when it has none", () => {
    const { container } = render(<TodaysIssue issue={ISSUE} />);
    const rows = container.querySelectorAll("ol > li");
    expect(rows[0].querySelector("img")?.getAttribute("src")).toBe("https://img.example/gemini.jpg");
    expect(rows[1].querySelector("img")).toBeNull();
    expect(rows[1].querySelector("[data-story-image-placeholder]")).not.toBeNull();
  });

  it("renders the outlets once per row", () => {
    const { container } = render(<TodaysIssue issue={ISSUE} />);
    const first = container.querySelectorAll("ol > li")[0];
    expect(first.textContent?.match(/Ars Technica/g)).toHaveLength(1);
  });
});
