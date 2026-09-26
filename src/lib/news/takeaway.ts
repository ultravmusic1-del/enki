import { parseArticleBody, splitFounderSection, type Inline } from "@/lib/news/article-body";

/**
 * The one-line founder takeaway shown on cards, today's brief and the story
 * header. It is the first "What it means for founders" bullet: its bold lead
 * plus its first sentence, capped so a card stays scannable.
 */

export const TAKEAWAY_MAX = 160;
const ELLIPSIS = String.fromCharCode(0x2026);

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

/** The founder takeaway, or null when the body has no founder bullet (legacy and summary-only stories). */
export function founderTakeaway(body: string | null | undefined): string | null {
  if (!body) return null;
  const { founders } = splitFounderSection(parseArticleBody(body));
  const list = founders?.find((b) => b.type === "list");
  const item = list && list.type === "list" ? list.items[0] : undefined;
  if (!item) return null;

  if (item[0]?.type === "bold") {
    const lead = item[0].text.trim();
    const rest = firstSentence(plain(item.slice(1)));
    if (!rest) return cap(lead);
    const joined = /[.:!?]$/.test(lead) ? `${lead} ${rest}` : `${lead}: ${rest}`;
    return cap(joined.trim());
  }
  return cap(firstSentence(plain(item)));
}

/** One line for "For founders", falling back to the summary when the body has no founder bullet. */
export function extractTakeaway(body: string, summary: string): string {
  return founderTakeaway(body) ?? cap(summary.trim());
}
