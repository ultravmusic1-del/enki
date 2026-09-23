/**
 * Enki Daily signup, via beehiiv's embedded subscribe forms (free plan, no API).
 *
 * The `src` values are the iframe URLs from each form's embed code in beehiiv
 * (Subscribe forms > form > Embed). They are public. Empty until the owner
 * creates the forms; BeehiivEmbed then renders its fallback.
 *
 * Each form redirects to /welcome?from=<key> after signup (set in beehiiv),
 * which is how Vercel Analytics attributes signups to a placement.
 */
export type NewsletterForm = "home" | "story" | "footer";

type FormConfig = { src: string; height: number; mobileHeight: number };

export const NEWSLETTER: { name: "Enki Daily"; hostedUrl: string; forms: Record<NewsletterForm, FormConfig> } = {
  name: "Enki Daily",
  /** beehiiv's hosted subscribe page, e.g. https://<publication>.beehiiv.com/subscribe. */
  hostedUrl: "",
  forms: {
    home: { src: "", height: 56, mobileHeight: 112 },
    story: { src: "", height: 56, mobileHeight: 112 },
    footer: { src: "", height: 56, mobileHeight: 112 },
  },
};

export const BEEHIIV_EMBED_SCRIPT = "https://subscribe-forms.beehiiv.com/embed.js";
export const BEEHIIV_ATTRIBUTION_SCRIPT = "https://subscribe-forms.beehiiv.com/attribution.js";
