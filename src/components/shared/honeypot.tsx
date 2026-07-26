/**
 * A bot trap. Positioned off-screen rather than `display: none` because many
 * form-filling bots skip hidden inputs but not offset ones. Removed from the
 * tab order and the accessibility tree, so a human never encounters it.
 *
 * Pair with a server-side check: a non-empty value means "silently discard".
 * The parent form needs `relative` so this is positioned against it and cannot
 * widen the page.
 */
export function Honeypot({ register }: { register: Record<string, unknown> }) {
  return (
    <div
      aria-hidden
      // Its children overflow this 1px box on purpose, so exempt it from the
      // visual sweep's containment check (see scripts/visual-sweep.mjs).
      data-sweep-ignore
      className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
    >
      <label htmlFor="enki-hp">Leave this field empty</label>
      <input id="enki-hp" type="text" tabIndex={-1} autoComplete="off" {...register} />
    </div>
  );
}
