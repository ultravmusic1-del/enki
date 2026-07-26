/**
 * The single authority on which URL schemes this app will store or emit.
 *
 * Zod v4's `z.url()` only asks whether `new URL()` parses, so it happily
 * accepts `javascript:`, `data:`, `vbscript:`, and `file:`. Those values reach
 * a stored field (`tools.website`, `tools.affiliateUrl`, and the public
 * `tool_submissions.url`) and from there an `href` or a `Location` header.
 *
 * A `javascript:` href executes in this origin when clicked. Today the one
 * admin sink carries `target="_blank"`, which current Chrome refuses to run
 * `javascript:` for -- but that is an incidental presentation attribute, not a
 * security control. This module is the control.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** True only for a well-formed absolute http(s) URL. */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  // Reject leading/trailing whitespace outright rather than trimming it: a
  // value that needs trimming to look safe is not a value we want to store.
  if (value !== value.trim()) return false;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * An href that is safe to render. Anything not http(s) becomes inert, which
 * covers rows written before the schema and database constraints existed.
 */
export function safeExternalHref(
  value: string | null | undefined,
  fallback = "#",
): string {
  return isHttpUrl(value) ? (value as string) : fallback;
}
