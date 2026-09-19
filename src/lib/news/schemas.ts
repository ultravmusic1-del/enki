import { z } from "zod";
import { beatSlugs } from "@/data/beats";
import { isHttpUrl } from "@/lib/safe-url";

export const HEADLINE_MAX = 300;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 320;
export const TAKE_MAX = 5000;
/** A take this long makes a story page indexable (spec §6.1). */
export const TAKE_INDEXABLE_MIN = 300;
export const MAX_STORY_TOOLS = 5;

const toolSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const storyPublishSchema = z.object({
  id: z.uuid(),
  headline: z.string().trim().min(1, "Add a headline.").max(HEADLINE_MAX),
  summary: z
    .string()
    .trim()
    .min(SUMMARY_MIN, `The summary needs at least ${SUMMARY_MIN} characters.`)
    .max(SUMMARY_MAX, `Keep the summary under ${SUMMARY_MAX} characters.`),
  take: z
    .string()
    .trim()
    .max(TAKE_MAX)
    .optional()
    .transform((v) => (v ? v : undefined)),
  beat: z.enum(beatSlugs, "Pick a beat."),
  featured: z.boolean(),
  toolSlugs: z
    .array(toolSlug)
    .max(MAX_STORY_TOOLS, `At most ${MAX_STORY_TOOLS} tools.`)
    .refine((slugs) => new Set(slugs).size === slugs.length, "A tool is listed twice."),
});

export type StoryPublishInput = z.input<typeof storyPublishSchema>;

export function isIndexableTake(take: string | null | undefined): boolean {
  return (take?.trim().length ?? 0) >= TAKE_INDEXABLE_MIN;
}

const httpUrl = z.string().trim().refine(isHttpUrl, "Must be an http:// or https:// URL.");

export const newsSourceInputSchema = z.object({
  name: z.string().trim().min(1, "Name the source.").max(80),
  feedUrl: httpUrl,
  siteUrl: httpUrl,
});

export type NewsSourceInput = z.input<typeof newsSourceInputSchema>;
