/**
 * The single authority on where a post-authentication redirect may point.
 *
 * A `?redirect=` parameter is attacker-controlled. Handing one straight to
 * `router.push()` turns the real login page into a phishing launcher: the
 * victim sees the genuine domain, authenticates, and only then lands on the
 * attacker's site -- the moment they are most convinced the site is real.
 *
 * Only same-origin paths survive. Anything else collapses to the fallback.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;

  // Must be a rooted path. Rejects "https://evil", "javascript:...", "evil.com".
  if (!raw.startsWith("/")) return fallback;

  // "//host" is protocol-relative and leaves the origin. "/\host" is the same
  // thing to browsers that normalize backslashes, so both are refused.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  return raw;
}
