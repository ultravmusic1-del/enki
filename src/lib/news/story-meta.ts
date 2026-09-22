import { BODY_INDEXABLE_MIN_WORDS } from "@/lib/news/schemas";

/** Stories per archive page. */
export const NEWS_PAGE_SIZE = 30;
/** Stories in a story page's "More in {Beat}" list. */
export const MORE_IN_BEAT = 5;

/**
 * A story page is `noindex, follow` until it carries a full article (full-stories
 * spec §6). Summary-only pages are the thin pages roadmap item 0.1b removed.
 */
export function storyRobots(bodyWords: number): { index: boolean; follow: true } {
  return { index: bodyWords >= BODY_INDEXABLE_MIN_WORDS, follow: true };
}

/**
 * The `[page]` segment of /news/page/[page]. Only a plain integer from 2 up is
 * a page: page 1 lives at /news, and anything else (0, 1, "007", "abc") must
 * 404 rather than render a duplicate or empty page.
 */
export function parsePageParam(raw: string): number | null {
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) return null;
  const page = Number(raw);
  return page >= 2 ? page : null;
}

export function pageCount(total: number, pageSize: number = NEWS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Inclusive row range for Supabase `.range(from, to)`. */
export function pageRange(page: number, pageSize: number = NEWS_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
