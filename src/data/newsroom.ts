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

export const NEWS_DESK_EMAIL = "enkidirectory@gmail.com";

/**
 * The named editor responsible for every story (owner's choice, 2026-09-26).
 * Set to null to fall back to "Checked by the Enki news desk".
 */
export const NEWS_EDITOR: Editor | null = { name: "VK", role: "Editor", email: NEWS_DESK_EMAIL };

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
