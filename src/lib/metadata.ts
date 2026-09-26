import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { OG_SIZE } from "@/lib/og";

type PageMetadataInput = {
  /** The page title, before the root layout's `%s · Enki` template. */
  title: string;
  description: string;
  /** Site-relative path, e.g. `/tools/cursor`. Becomes canonical and og:url. */
  path: string;
  /** A share title, when it should differ from `<title>`. */
  socialTitle?: string;
  type?: "website" | "article";
  /**
   * The route segment has its own `opengraph-image` / `twitter-image` files.
   * Config images outrank those files, so the site card must then be left out.
   */
  ownImage?: boolean;
  /** Extra Open Graph fields, e.g. `publishedTime` on an article. */
  openGraph?: Record<string, unknown>;
  robots?: Metadata["robots"];
};

/** The site card, from the root `opengraph-image` / `twitter-image` routes. */
const SITE_IMAGE = {
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  alt: `${siteConfig.name}: ${siteConfig.tagline}`,
};

/**
 * Metadata for one indexable page, with its share tags filled in.
 *
 * Next.js replaces nested metadata objects rather than merging them, and it
 * never derives `og:title` from `<title>`. A page that set only a title and a
 * description therefore inherited the root layout's Open Graph block: the
 * homepage's title, description and `og:url`. Every share of such a page
 * previewed as the homepage, and platforms that key on `og:url` credited the
 * share to it. Building both blocks here keeps each page describing itself.
 *
 * A page-level `openGraph` block also replaces the inherited image list, so the
 * site card is set as the default. Segments with their own image files (tools,
 * stories) pass `ownImage`, because an image set here would replace theirs.
 */
export function pageMetadata({
  title,
  description,
  path,
  socialTitle,
  type = "website",
  ownImage = false,
  openGraph,
  robots,
}: PageMetadataInput): Metadata {
  const shareTitle = socialTitle ?? `${title} · ${siteConfig.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName: siteConfig.name,
      url: path,
      title: shareTitle,
      description,
      ...(ownImage ? {} : { images: [{ url: "/opengraph-image", ...SITE_IMAGE }] }),
      ...openGraph,
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      ...(ownImage ? {} : { images: [{ url: "/twitter-image", ...SITE_IMAGE }] }),
    },
    ...(robots ? { robots } : {}),
  };
}
