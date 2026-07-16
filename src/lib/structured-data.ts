import { siteConfig } from "@/lib/site";
import type { Tool } from "@/lib/schemas";
import type { ReviewWithAuthor } from "@/lib/content";

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

/** SoftwareApplication (with ratings + reviews) + BreadcrumbList for a tool. */
export function toolJsonLd({
  tool,
  categoryName,
  reviews,
}: {
  tool: Tool;
  categoryName?: string;
  reviews: ReviewWithAuthor[];
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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: tool.rating,
      reviewCount: tool.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.author?.name ?? "Anonymous" },
      datePublished: r.date,
      name: r.title,
      reviewBody: r.body,
    })),
  };
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
