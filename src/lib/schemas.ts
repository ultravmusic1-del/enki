import { z } from "zod";

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
  /** Hue (0–360) used to synthesize the gradient placeholder "screen". */
  hue: z.number().min(0).max(360),
});

export const toolSchema = z.object({
  slug,
  /** Path to the brand logo under /public (optional; falls back to a monogram). */
  logo: z.string().optional(),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().min(1),
  website: z.url(),
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
  foundedYear: z.number().int().min(1990).max(2100),
  company: z.string().min(1),
  screenshots: z.array(screenshotSchema).min(1),
  verdict: z.string().min(1),
  editorScore: z.number().min(0).max(10),
  /** Canonical displayed aggregate rating, 1–5 with one decimal. */
  rating: z.number().min(1).max(5),
  reviewCount: z.number().int().min(0),
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
  helpful: z.number().int().min(0),
  verified: z.boolean(),
});

export type Review = z.infer<typeof reviewSchema>;

/* ------------------------------------------------- client-side review form */

/** Schema for the "Write a review" modal (RHF + Zod, client-only). */
export const reviewFormSchema = z.object({
  name: z.string().min(2, "Please enter your name").max(60),
  rating: z.number().int().min(1, "Please choose a rating").max(5),
  title: z.string().min(4, "Give your review a short title").max(80),
  body: z
    .string()
    .min(20, "Tell us a little more (at least 20 characters)")
    .max(1000),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/* -------------------------------------------------- newsletter form (footer) */

export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type NewsletterValues = z.infer<typeof newsletterSchema>;
