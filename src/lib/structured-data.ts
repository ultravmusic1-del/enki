import { siteConfig } from "@/lib/site";
import type { Tool } from "@/lib/schemas";

/* =========================================================================
   Schema.org JSON-LD builders. Kept out of the components so the shapes are
   testable and reused consistently. All URLs are absolute (required by
   search engines) and resolved against the canonical site URL.
   ========================================================================= */

const BASE = siteConfig.url;
const abs = (path: string) => new URL(path, BASE).toString();

/** Organization + WebSite (with sitewide search), emitted once in the layout. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE}/#organization`,
        name: siteConfig.name,
        url: BASE,
        description: siteConfig.description,
        logo: abs(siteConfig.ogImage),
        // Connects the entity to its verified profile. Only accounts Enki
        // actually controls belong here.
        sameAs: [siteConfig.social.instagram],
      },
      {
        "@type": "WebSite",
        "@id": `${BASE}/#website`,
        name: siteConfig.name,
        url: BASE,
        description: siteConfig.description,
        publisher: { "@id": `${BASE}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${BASE}/tools?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** Derive a valid Offer from the tool's pricing, or nothing if indeterminate. */
function toolOffer(tool: Tool): Record<string, unknown> | null {
  const { model, startingPrice } = tool.pricing;
  const parsed = startingPrice?.match(/[\d.]+/)?.[0];
  const price =
    model === "free" || model === "freemium" ? "0" : (parsed ?? null);
  if (price === null) return null;
  return {
    "@type": "Offer",
    price,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: abs(`/tools/${tool.slug}`),
  };
}

/**
 * SoftwareApplication + BreadcrumbList for a tool.
 *
 * Deliberately carries no AggregateRating or Review: it previously took a
 * `reviews` argument for that, gated behind a flag that was never true.
 */
export function toolJsonLd({
  tool,
  categoryName,
}: {
  tool: Tool;
  categoryName?: string;
}) {
  const url = abs(`/tools/${tool.slug}`);
  const offer = toolOffer(tool);

  const application: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: tool.name,
    description: tool.description,
    url,
    applicationCategory: categoryName ? `${categoryName} — AI tool` : "AI tool",
    operatingSystem: tool.platforms.join(", ") || "Web",
  };

  // No AggregateRating or Review markup is emitted. Structured data is a
  // machine-readable claim to search engines, and marking up ratings that are
  // not genuine breaches Google's review-snippet policy -- on a site that
  // earns affiliate revenue from its rankings, that is also an FTC exposure.
  // The fields this used to read (tool.rating, tool.reviewCount) no longer
  // exist. Add this back only when real moderated reviews can populate it.

  if (tool.logo) application.image = abs(tool.logo);
  if (offer) application.offers = offer;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Tools", item: abs("/tools") },
      { "@type": "ListItem", position: 3, name: tool.name, item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [application, breadcrumb],
  };
}

/* ------------------------------------------------- reusable page builders */

/** ItemList — for ranked "best" and "alternatives" landing pages. */
export function itemListJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: abs(it.url),
    })),
  };
}

/** FAQPage — for the Q&A blocks on best/vs pages. */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** BreadcrumbList — shared across the new landing pages. */
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}
