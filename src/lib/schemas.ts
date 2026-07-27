import { z } from "zod";
import { isHttpUrl } from "@/lib/safe-url";

/* =========================================================================
   Enki — content schemas (Sanity-shaped)

   These Zod schemas mirror the documents we would author in a live Sanity
   dataset. Seed data in `src/data/*` is validated against them at module load
   (see `src/lib/content.ts`), so a later swap to real Sanity + GROQ is a
   config change, not a rewrite.
   ========================================================================= */

/** A hex colour like `#00ADB5`. Used for per-entity accents / monograms. */
const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour, e.g. #00ADB5");

/** URL-safe slug. */
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase kebab-case slug");

/** Lucide icon name, resolved through the icon registry (guards 1.x renames). */
const iconName = z.string().min(1);

/**
 * An absolute http(s) URL. Plain `z.url()` is not enough: it accepts
 * `javascript:`, `data:`, and `file:` because it only checks that the URL
 * parses. See src/lib/safe-url.ts.
 */
const httpUrl = z
  .string()
  .refine(isHttpUrl, "Must be an http:// or https:// URL");

/* ------------------------------------------------------------------ category */

export const categorySchema = z.object({
  slug,
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  icon: iconName,
  accent: hexColor,
});

export type Category = z.infer<typeof categorySchema>;

/* ---------------------------------------------------------------------- tool */

export const pricingModel = z.enum(["free", "freemium", "paid", "enterprise"]);
export type PricingModel = z.infer<typeof pricingModel>;

export const pricingSchema = z.object({
  model: pricingModel,
  startingPrice: z.string().optional(),
  hasFreeTrial: z.boolean().optional(),
  note: z.string().optional(),
});

export const keyFeatureSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  icon: iconName,
});

export const screenshotSchema = z.object({
  title: z.string().min(1),
  caption: z.string().min(1),
  /**
   * Path to a real product screenshot under /public (optional). All captures
   * are a fixed 1280×800 (16:10) for visual consistency across tool pages.
   * When absent, the carousel synthesizes a gradient "screen" from `hue`.
   */
  src: z.string().optional(),
  /** Hue (0–360) used to synthesize the gradient placeholder when `src` is absent. */
  hue: z.number().min(0).max(360),
});

/** An optional promotional deal/coupon for a tool. */
export const dealSchema = z.object({
  /** Short headline, e.g. "20% off annual plans". */
  headline: z.string().min(1),
  /** Coupon code, if any. */
  code: z.string().min(1).optional(),
  /** One extra line of detail/terms. */
  detail: z.string().min(1).optional(),
  /** ISO date (YYYY-MM-DD) the deal expires; absent = ongoing. */
  expiresAt: z.iso.date().optional(),
});

export type Deal = z.infer<typeof dealSchema>;

export const toolSchema = z.object({
  slug,
  /** Path to the brand logo under /public (optional; falls back to a monogram). */
  logo: z.string().optional(),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().min(1),
  website: httpUrl,
  /** Optional affiliate/referral URL; when set, outbound links use it and are marked rel="sponsored". */
  affiliateUrl: httpUrl.optional(),
  categorySlug: slug,
  tags: z.array(z.string().min(1)).min(1),
  pricing: pricingSchema,
  pros: z.array(z.string().min(1)).min(1),
  cons: z.array(z.string().min(1)).min(1),
  keyFeatures: z.array(keyFeatureSchema).min(1),
  integrations: z.array(z.string().min(1)),
  platforms: z.array(z.string().min(1)).min(1),
  accent: hexColor,
  featured: z.boolean(),
  /** Paid promoted placement (absent = not sponsored); never affects editorial score/rank. */
  sponsored: z.boolean().optional(),
  /** Optional promotional deal/coupon. */
  deal: dealSchema.optional(),
  foundedYear: z.number().int().min(1990).max(2100),
  /** ISO date (YYYY-MM-DD) an editor last re-checked this listing. */
  lastVetted: z.iso.date().optional(),
  company: z.string().min(1),
  screenshots: z.array(screenshotSchema).min(1),
  verdict: z.string().min(1),
  /**
   * Enki's editorial judgement, 0-10. The only score this project can honestly
   * claim: it is written by the editor, not aggregated from users.
   *
   * There is deliberately no `rating` or `reviewCount` here. Those existed as
   * editorial sample figures but were displayed as a community aggregate
   * ("N reviews", "Average rating") on a site that earns affiliate revenue from
   * its rankings. Real community sentiment comes from the `reviews` table via
   * CommunityRatingSummary, which averages approved reviews only and shows
   * nothing until there are some.
   */
  editorScore: z.number().min(0).max(10),
});

export type Tool = z.infer<typeof toolSchema>;

/* -------------------------------------------------------------------- author */

export const authorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  accent: hexColor,
});

export type Author = z.infer<typeof authorSchema>;

/* -------------------------------------------------------------------- review */

export const reviewSchema = z.object({
  id: z.string().min(1),
  toolSlug: slug,
  authorId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1),
  body: z.string().min(1),
  /** ISO date string, e.g. 2025-11-03. */
  date: z.iso.date(),
});

export type Review = z.infer<typeof reviewSchema>;

/* ------------------------------------------------- client-side review form */

/**
 * Schema for the "Write a review" modal (RHF + Zod, client-only). Only the
 * star rating and name are required; the title and comments are optional.
 */
export const reviewFormSchema = z.object({
  name: z.string().min(2, "Please enter your name").max(60),
  rating: z.number().int().min(1, "Please choose a rating").max(5),
  title: z.string().max(80, "Keep the title under 80 characters").optional(),
  body: z.string().max(1000, "Keep it under 1000 characters").optional(),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/* -------------------------------------------------- newsletter form (footer) */

/**
 * Hidden bot-trap field. Never shown to a human, so any value at all means the
 * submitter is automated. It is `optional()` and never fails validation — the
 * server actions decide what to do with it, so a bot gets a normal-looking
 * success rather than a signal that it was detected.
 */
const honeypot = z.string().optional();

export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  hp: honeypot,
});

export type NewsletterValues = z.infer<typeof newsletterSchema>;

/* ------------------------------------------------ submit-a-tool form */

export const submissionFormSchema = z.object({
  name: z.string().min(1, "Enter the tool's name").max(80),
  url: z
    .string()
    .max(2048)
    .refine(isHttpUrl, "Enter a valid http:// or https:// URL"),
  categorySlug: z.string().max(64).optional(),
  pitch: z
    .string()
    .max(500, "Keep the pitch under 500 characters")
    .optional(),
  submitterEmail: z
    .union([z.email("Enter a valid email").max(254), z.literal("")])
    .optional(),
  hp: honeypot,
});

export type SubmissionValues = z.infer<typeof submissionFormSchema>;
