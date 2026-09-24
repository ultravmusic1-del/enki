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
  hostedUrl: "https://enki-tools-f421fc.beehiiv.com/subscribe",
  forms: {
    home: { src: "https://subscribe-forms.beehiiv.com/c82cbe13-e840-4ee4-bda4-390ab6c05806", height: 72, mobileHeight: 72 },
    story: { src: "https://subscribe-forms.beehiiv.com/6a795064-6c33-43d1-8572-2a53a7948d1e", height: 72, mobileHeight: 72 },
    footer: { src: "https://subscribe-forms.beehiiv.com/8dd4b800-9334-4514-a479-7213d9ececcc", height: 72, mobileHeight: 72 },
  },
};

export const BEEHIIV_EMBED_SCRIPT = "https://subscribe-forms.beehiiv.com/embed.js";
export const BEEHIIV_ATTRIBUTION_SCRIPT = "https://subscribe-forms.beehiiv.com/attribution.js";
