import { describe, it, expect } from "vitest";
import { buildIssue, extractTakeaway, founderMarkdown, makingStats, type IssueStoryInput } from "@/lib/news/issue";

const FOUNDERS = "## What it means for founders";
const NOW = new Date("2026-09-23T12:00:00Z");

function body(bullets: string[]): string {
  return ["Lede paragraph with a [link](https://example.com/a).", "", FOUNDERS, "", ...bullets.map((b) => `- ${b}`)].join("\n");
}

function story(over: Partial<IssueStoryInput> = {}): IssueStoryInput {
  return {
    slug: "s",
    headline: "Headline",
    summary: "A summary that is long enough to be a real standfirst for the story.",
    beat: "policy-safety",
    beatName: "Policy & Safety",
    body: body(["**Weak credentials are exposed:** Two of three used leaked keys. Scan your repos."]),
    bodyWords: 600,
    publishedAt: "2026-09-23T08:00:00Z",
    featured: false,
    sources: ["The Verge"],
    ...over,
  };
}

describe("extractTakeaway", () => {
  it("joins the bold lead and the first sentence", () => {
    expect(extractTakeaway(body(["**Weak credentials are exposed:** Two of three used leaked keys. Scan your repos."]), "x"))
      .toBe("Weak credentials are exposed: Two of three used leaked keys.");
  });

  it("adds a colon when the bold lead has no closing punctuation", () => {
    expect(extractTakeaway(body(["**Verification matters** Budget for review. More text."]), "x"))
      .toBe("Verification matters: Budget for review.");
  });

  it("keeps link text and drops Markdown syntax", () => {
    expect(extractTakeaway(body(["**Watch it.** Read [the filing](https://example.com/f) first. Then act."]), "x"))
      .toBe("Watch it. Read the filing first.");
  });

  it("uses the first sentence when there is no bold lead", () => {
    expect(extractTakeaway(body(["Plan for platforms saying no. They can."]), "x")).toBe("Plan for platforms saying no.");
  });

  it("falls back to the summary when there is no founder section", () => {
    expect(extractTakeaway("Just a paragraph.", "The summary. Second sentence.")).toBe("The summary. Second sentence.");
  });

  it("caps at 160 characters on a word boundary with an ellipsis", () => {
    const long = `**Lead:** ${"word ".repeat(60)}end.`;
    const out = extractTakeaway(body([long]), "x");
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith(String.fromCharCode(0x2026))).toBe(true);
    expect(out.at(-2)).not.toBe(" ");
  });
});

describe("founderMarkdown", () => {
  it("returns the founder heading and everything after it", () => {
    expect(founderMarkdown(body(["**A:** b."]))).toBe(`${FOUNDERS}\n\n- **A:** b.`);
  });
  it("returns null without a founder section", () => {
    expect(founderMarkdown("No section here.")).toBeNull();
  });
});

describe("buildIssue", () => {
  it("returns null with no stories", () => {
    expect(buildIssue([], NOW)).toBeNull();
  });

  it("puts the featured story first, then newest first, and takes 3", () => {
    const issue = buildIssue(
      [
        story({ slug: "a", publishedAt: "2026-09-23T09:00:00Z" }),
        story({ slug: "b", publishedAt: "2026-09-23T08:00:00Z", featured: true }),
        story({ slug: "c", publishedAt: "2026-09-22T08:00:00Z" }),
        story({ slug: "d", publishedAt: "2026-09-21T08:00:00Z" }),
      ],
      NOW,
    )!;
    expect(issue.stories.map((s) => s.slug)).toEqual(["b", "a", "c"]);
    expect(issue.lead.slug).toBe("b");
  });

  it("renders what exists when there are fewer than 3", () => {
    expect(buildIssue([story({ slug: "only" })], NOW)!.stories).toHaveLength(1);
  });

  it("dedupes outlets in order and labels the newest story's date", () => {
    const issue = buildIssue([story({ sources: ["The Verge", "TechCrunch", "The Verge"] })], NOW)!;
    expect(issue.stories[0].outlets).toEqual(["The Verge", "TechCrunch"]);
    expect(issue.dateLabel).toBe("Wed 23 Sep");
  });

  it("leads with a featured story within the lead window even if older, and labels/counts from the newest day", () => {
    const issue = buildIssue(
      [
        story({ slug: "in-window-featured", publishedAt: "2026-09-21T20:00:00Z", featured: true }),
        story({ slug: "new-a", publishedAt: "2026-09-23T09:00:00Z" }),
        story({ slug: "new-b", publishedAt: "2026-09-23T07:00:00Z" }),
      ],
      new Date("2026-09-23T12:00:00Z"),
    )!;
    expect(issue.lead.slug).toBe("in-window-featured");
    expect(issue.dateLabel).toBe("Wed 23 Sep");
    expect(issue.totalCount).toBe(2);
  });

  it("does not lead with a featured story outside the lead window; newest leads instead", () => {
    const issue = buildIssue(
      [
        story({ slug: "old-featured", publishedAt: "2026-09-21T08:00:00Z", featured: true }),
        story({ slug: "new-a", publishedAt: "2026-09-23T09:00:00Z" }),
        story({ slug: "new-b", publishedAt: "2026-09-23T07:00:00Z" }),
      ],
      new Date("2026-09-23T12:00:00Z"),
    )!;
    expect(issue.lead.slug).toBe("new-a");
  });

  it("counts full stories on the lead's day and rounds minutes at 230 wpm", () => {
    const issue = buildIssue(
      [
        story({ slug: "a", publishedAt: "2026-09-23T09:00:00Z", bodyWords: 600 }),
        story({ slug: "b", publishedAt: "2026-09-23T07:00:00Z", bodyWords: 600 }),
        story({ slug: "c", publishedAt: "2026-09-23T06:00:00Z", bodyWords: 600 }),
        story({ slug: "d", publishedAt: "2026-09-23T05:00:00Z", bodyWords: 600 }),
        story({ slug: "e", publishedAt: "2026-09-22T05:00:00Z", bodyWords: 600 }),
      ],
      NOW,
    )!;
    expect(issue.totalCount).toBe(4);
    expect(issue.minutes).toBe(8); // 1800 / 230 = 7.8
  });

  it("gives the lead's founder markdown for the anatomy section", () => {
    expect(buildIssue([story()], NOW)!.lead.founderMarkdown).toContain("## What it means for founders");
  });
});

describe("makingStats", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("counts stories, distinct outlets and source rows in the last 7 days", () => {
    expect(
      makingStats(
        [
          story({ sources: ["The Verge", "TechCrunch"] }),
          story({ sources: ["The Verge", "Ars Technica", "TechCrunch"] }),
          story({ publishedAt: "2026-09-10T00:00:00Z", sources: ["Old Outlet"] }),
        ],
        now,
      ),
    ).toEqual({ stories: 2, outlets: 3, sources: 5 });
  });
});
