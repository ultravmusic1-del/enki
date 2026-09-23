import { getBeat, type BeatSlug } from "@/data/beats";

/**
 * Whether a header nav item is the current section. Nothing is active on
 * "/", the newsletter funnel; "News" (href "/news") is active on /news and
 * every /news/* page via the default rule below.
 */
export function isNavActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Which beat row item is current: "latest" for the homepage and /news pages. */
export function activeBeatFor(pathname: string): BeatSlug | "latest" | null {
  if (pathname === "/" || pathname === "/news" || pathname.startsWith("/news/page/")) {
    return "latest";
  }
  const match = /^\/news\/beat\/([a-z-]+)$/.exec(pathname);
  return match ? (getBeat(match[1])?.slug ?? null) : null;
}
