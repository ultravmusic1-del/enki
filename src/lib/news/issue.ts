import type { BeatSlug } from "@/data/beats";
import { parseArticleBody, splitFounderSection, type Inline } from "@/lib/news/article-body";
import { FOUNDER_HEADING } from "@/lib/news/schemas";
import { LEAD_WINDOW_HOURS } from "@/lib/news/home-feed";

export type IssueStoryInput = {
  slug: string;
  headline: string;
  summary: string;
  beat: BeatSlug;
  beatName: string;
  body: string;
  bodyWords: number;
  publishedAt: string;
  featured: boolean;
  /** Source names, one per source row, the story's own first. */
  sources: string[];
  imageUrl: string | null;
};

export type IssueStory = {
  slug: string;
  headline: string;
  beat: BeatSlug;
  beatName: string;
  outlets: string[];
  takeaway: string;
  imageUrl: string | null;
};

export type Issue = {
  dateLabel: string;
  totalCount: number;
  minutes: number;
  stories: IssueStory[];
  lead: { slug: string; headline: string; founderMarkdown: string | null };
};

export type MakingStats = { stories: number; outlets: number; sources: number };

const ISSUE_SIZE = 3;
const WORDS_PER_MINUTE = 230;
const TAKEAWAY_MAX = 160;
const ELLIPSIS = String.fromCharCode(0x2026);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A story counts as featured for the issue only within LEAD_WINDOW_HOURS, matching /news. */
export function isFeaturedInWindow(publishedAt: string, now: Date): boolean {
  return now.getTime() - new Date(publishedAt).getTime() <= LEAD_WINDOW_HOURS * HOUR_MS;
}

function plain(inlines: Inline[]): string {
  return inlines.map((p) => p.text).join("").replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

function cap(text: string): string {
  if (text.length <= TAKEAWAY_MAX) return text;
  const cut = text.slice(0, TAKEAWAY_MAX - 1);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > 0 ? cut.slice(0, atSpace) : cut).replace(/[\s,;:]+$/, "")}${ELLIPSIS}`;
}

/** One line for "For founders": the first founder bullet's bold lead plus its first sentence. */
export function extractTakeaway(body: string, summary: string): string {
  const { founders } = splitFounderSection(parseArticleBody(body));
  const list = founders?.find((b) => b.type === "list");
  const item = list && list.type === "list" ? list.items[0] : undefined;
  if (!item) return cap(summary.trim());

  if (item[0]?.type === "bold") {
    const lead = item[0].text.trim();
    const rest = firstSentence(plain(item.slice(1)));
    const joined = /[.:!?]$/.test(lead) ? `${lead} ${rest}` : `${lead}: ${rest}`;
    return cap(joined.trim());
  }
  return cap(firstSentence(plain(item)));
}

/** The founder section as Markdown (heading and everything after), or null. */
export function founderMarkdown(body: string): string | null {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const at = lines.findIndex((l) => l.trimEnd() === `## ${FOUNDER_HEADING}`);
  if (at === -1) return null;
  return lines.slice(at).join("\n").trim();
}

const dayKey = (iso: string) => iso.slice(0, 10);

function dateLabel(iso: string): string {
  const d = new Date(iso);
  // en-US on purpose: en-GB abbreviates September as "Sept" in current ICU.
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}

export function buildIssue(inputs: IssueStoryInput[], now: Date): Issue | null {
  if (inputs.length === 0) return null;
  const newest = [...inputs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const featured = newest.find((s) => s.featured && isFeaturedInWindow(s.publishedAt, now));
  const ordered = featured ? [featured, ...newest.filter((s) => s !== featured)] : newest;
  const shown = ordered.slice(0, ISSUE_SIZE);
  const lead = shown[0];
  const words = shown.reduce((sum, s) => sum + s.bodyWords, 0);
  // The masthead date is the newest story's day, not necessarily the
  // (featured) lead's day: a featured story can be older than same-day news.
  const newestPublishedAt = newest[0].publishedAt;

  return {
    dateLabel: dateLabel(newestPublishedAt),
    totalCount: inputs.filter((s) => dayKey(s.publishedAt) === dayKey(newestPublishedAt)).length,
    minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    stories: shown.map((s) => ({
      slug: s.slug,
      headline: s.headline,
      beat: s.beat,
      beatName: s.beatName,
      outlets: [...new Set(s.sources)],
      takeaway: extractTakeaway(s.body, s.summary),
      imageUrl: s.imageUrl,
    })),
    lead: { slug: lead.slug, headline: lead.headline, founderMarkdown: founderMarkdown(lead.body) },
  };
}

export function makingStats(inputs: IssueStoryInput[], now: Date): MakingStats {
  const since = now.getTime() - 7 * DAY_MS;
  const recent = inputs.filter((s) => new Date(s.publishedAt).getTime() >= since);
  const outlets = new Set(recent.flatMap((s) => s.sources));
  return {
    stories: recent.length,
    outlets: outlets.size,
    sources: recent.reduce((sum, s) => sum + s.sources.length, 0),
  };
}
