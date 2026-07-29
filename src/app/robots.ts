import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Everything is crawlable on purpose. Pages that must not be indexed
    // (/saved, /collections, /admin, /account, /unsubscribe) carry a `noindex`
    // in their metadata instead. Disallowing them here would be worse than
    // useless: a blocked crawler never fetches the page, so it never sees the
    // noindex, and the bare URL can still surface in results without a snippet.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
