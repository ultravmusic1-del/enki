import { z } from "zod";
import { beatSlugs } from "@/data/beats";
import { isHttpUrl } from "@/lib/safe-url";

export const HEADLINE_MAX = 300;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 320;
export const MAX_STORY_TOOLS = 5;

export const BODY_MIN_WORDS = 300;
export const BODY_MAX_WORDS = 1200;
/** A story page is indexable once its body reaches this many words (full-stories spec §6). */
export const BODY_INDEXABLE_MIN_WORDS = BODY_MIN_WORDS;
export const FOUNDER_HEADING = "What it means for founders";

// Built from char codes: the editing tools decode escape sequences into the real characters.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);
const FOUNDER_LINE = new RegExp(`^## ${FOUNDER_HEADING}[ \\t]*$`, "m");

// JS `\s` and Postgres whitespace disagree at a few code points (U+FEFF, U+0085), and JS's
// `m`-flag `^`/`$` treat line ends (bare CR, U+2028, U+2029) that the SQL heading check does
// not. Normalising first keeps the editor, this schema and the database constraint agreed.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const NEXT_LINE = String.fromCharCode(0x85);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const BYTE_ORDER_MARK_RE = new RegExp(BYTE_ORDER_MARK, "g");
const NEXT_LINE_RE = new RegExp(NEXT_LINE, "g");
const LINE_SEPARATOR_RE = new RegExp(LINE_SEPARATOR, "g");
const PARAGRAPH_SEPARATOR_RE = new RegExp(PARAGRAPH_SEPARATOR, "g");

/** Makes line ends and whitespace agree with the database before counting or validating a body. */
export function normalizeBody(text: string): string {
  return text
    .replace(BYTE_ORDER_MARK_RE, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(NEXT_LINE_RE, "\n")
    .replace(LINE_SEPARATOR_RE, "\n")
    .replace(PARAGRAPH_SEPARATOR_RE, "\n");
}

/** Whitespace-split word count. Must agree with the generated column stories.body_words. */
export function countWords(text: string | null | undefined): number {
  const trimmed = normalizeBody(text ?? "").trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Why a body would be refused, in plain words. Mirrors the stories_body_check constraint. */
export function bodyProblems(body: string): string[] {
  const normalized = normalizeBody(body);
  const problems: string[] = [];
  const words = countWords(normalized);
  if (words < BODY_MIN_WORDS || words > BODY_MAX_WORDS) {
    problems.push(`The story needs ${BODY_MIN_WORDS} to ${BODY_MAX_WORDS} words (it has ${words}).`);
  }
  if (normalized.includes(EN_DASH) || normalized.includes(EM_DASH)) {
    problems.push("Replace the en or em dash with a comma, colon or full stop.");
  }
  if (!FOUNDER_LINE.test(normalized)) {
    problems.push(`Add the heading "## ${FOUNDER_HEADING}" on its own line.`);
  }
  return problems;
}

/** Editorial targets. Advisory only: the editor shows them, nothing enforces them. */
export const HEADLINE_TARGET_MAX = 80;
export const BODY_TARGET_MAX_WORDS = 600;
/** The founder section should carry at least this share of the story's words. */
export const FOUNDER_TARGET_SHARE = 0.2;
/** More attributions than this and the story is recapping other outlets. */
const RECAP_ATTRIBUTIONS_MAX = 5;

const UNCERTAINTY = /^##\s.*\b(don't know|do not know|unknown|uncertain|unclear|open questions?|unanswered)\b/im;
const WATCH_NEXT = /\b(watch|next|expect|deadline|decision due|timeline)\b/i;
const ATTRIBUTION = /\b(reported|according to|told [A-Z]|said in an interview)\b/g;

/**
 * Advice for a tighter story: fewer words recapping other outlets, more on
 * consequences, uncertainty and what to watch. Never blocks publishing; the
 * hard rules are in bodyProblems.
 */
export function storyAdvice({ headline, body }: { headline: string; body: string }): string[] {
  const advice: string[] = [];
  const title = headline.trim();
  if (title.length > HEADLINE_TARGET_MAX) {
    advice.push(`Shorten the headline to ${HEADLINE_TARGET_MAX} characters or fewer so cards stay scannable (it has ${title.length}).`);
  }
  const normalized = normalizeBody(body).trim();
  if (!normalized) return advice;

  const words = countWords(normalized);
  if (words > BODY_TARGET_MAX_WORDS) {
    advice.push(`Aim for ${BODY_TARGET_MAX_WORDS} words or fewer (it has ${words}). Cut recap before consequences.`);
  }
  const at = normalized.search(FOUNDER_LINE);
  const founderPart = at === -1 ? "" : normalized.slice(at);
  if (at !== -1 && words > 0 && countWords(founderPart) / words < FOUNDER_TARGET_SHARE) {
    const share = Math.round((countWords(founderPart) / words) * 100);
    advice.push(`The founder section is ${share}% of the story. Give it at least ${Math.round(FOUNDER_TARGET_SHARE * 100)}%.`);
  }
  if (!UNCERTAINTY.test(normalized)) {
    advice.push(`Say what is still uncertain, for example in a "## What we don't know yet" section.`);
  }
  if (at !== -1 && !WATCH_NEXT.test(founderPart)) {
    advice.push("Name what founders should watch next: a date, a decision or a signal.");
  }
  const attributions = (normalized.match(ATTRIBUTION) ?? []).length;
  if (attributions > RECAP_ATTRIBUTIONS_MAX) {
    advice.push(`${attributions} attributions to other outlets reads as a recap. Cite each source once and move to what it means.`);
  }
  return advice;
}

const toolSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const storyPublishSchema = z.object({
  id: z.uuid(),
  headline: z.string().trim().min(1, "Add a headline.").max(HEADLINE_MAX),
  summary: z
    .string()
    .trim()
    .min(SUMMARY_MIN, `The summary needs at least ${SUMMARY_MIN} characters.`)
    .max(SUMMARY_MAX, `Keep the summary under ${SUMMARY_MAX} characters.`),
  body: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeBody(v).trim() : undefined))
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      for (const message of bodyProblems(v)) ctx.addIssue({ code: "custom", message });
    }),
  beat: z.enum(beatSlugs, "Pick a beat."),
  featured: z.boolean(),
  toolSlugs: z
    .array(toolSlug)
    .max(MAX_STORY_TOOLS, `At most ${MAX_STORY_TOOLS} tools.`)
    .refine((slugs) => new Set(slugs).size === slugs.length, "A tool is listed twice."),
});

export type StoryPublishInput = z.input<typeof storyPublishSchema>;

const httpUrl = z.string().trim().refine(isHttpUrl, "Must be an http:// or https:// URL.");

export const newsSourceInputSchema = z.object({
  name: z.string().trim().min(1, "Name the source.").max(80),
  feedUrl: httpUrl,
  siteUrl: httpUrl,
});

export type NewsSourceInput = z.input<typeof newsSourceInputSchema>;
