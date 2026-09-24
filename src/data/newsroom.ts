/**
 * Who stands behind Enki's news, and every correction it has made.
 *
 * Git-versioned on purpose: a correction is a public promise, so it is
 * reviewed like code and can never be silently edited away. Add a
 * correction here when a published story is changed to fix an error; the
 * story shows it, its "Updated" time moves, and /news/corrections lists it.
 */

export type Editor = {
  name: string;
  /** Shown after the name, e.g. "Editor". */
  role: string;
  email: string;
};

/**
 * The named editor responsible for every story. Owner decision pending: set
 * the name the site should print. While it is null, pages say "Edited by the
 * Enki news desk" and point to the corrections email.
 */
export const NEWS_EDITOR: Editor | null = null;

export const NEWS_DESK_EMAIL = "enkidirectory@gmail.com";

export type Correction = {
  /** The corrected story's slug. */
  slug: string;
  /** When the correction was published (ISO 8601, UTC). */
  at: string;
  /** What was wrong and what the story now says. Plain text. */
  note: string;
};

export const corrections: readonly Correction[] = [];

export function correctionsFor(slug: string, all: readonly Correction[] = corrections): Correction[] {
  return all.filter((c) => c.slug === slug).sort((a, b) => a.at.localeCompare(b.at));
}

/** A story's last update: its newest correction, or null when it has none. */
export function lastUpdatedAt(slug: string, all: readonly Correction[] = corrections): string | null {
  const own = correctionsFor(slug, all);
  return own.length > 0 ? own[own.length - 1].at : null;
}
