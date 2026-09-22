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

/** Whitespace-split word count. Must agree with the generated column stories.body_words. */
export function countWords(text: string | null | undefined): number {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Why a body would be refused, in plain words. Mirrors the stories_body_check constraint. */
export function bodyProblems(body: string): string[] {
  const problems: string[] = [];
  const words = countWords(body);
  if (words < BODY_MIN_WORDS || words > BODY_MAX_WORDS) {
    problems.push(`The story needs ${BODY_MIN_WORDS} to ${BODY_MAX_WORDS} words (it has ${words}).`);
  }
  if (body.includes(EN_DASH) || body.includes(EM_DASH)) {
    problems.push("Replace the en or em dash with a comma, colon or full stop.");
  }
  if (!FOUNDER_LINE.test(body)) {
    problems.push(`Add the heading "## ${FOUNDER_HEADING}" on its own line.`);
  }
  return problems;
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
    .transform((v) => (v ? v : undefined))
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
