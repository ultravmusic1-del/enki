/**
 * In-flight state, derived rather than written down.
 *
 * A hand-maintained "current status" section drifts the moment someone forgets
 * to update it. Git already knows what is unfinished, so ask git.
 */

/** @param {string} output From `git rev-list --left-right --count <upstream>...HEAD`. */
export function parseAheadBehind(output) {
  const [behind, ahead] = output.trim().split(/\s+/).map(Number);
  return {
    behind: Number.isFinite(behind) ? behind : 0,
    ahead: Number.isFinite(ahead) ? ahead : 0,
  };
}

/** @param {string} porcelain From `git status --porcelain`. */
export function countDirtyFiles(porcelain) {
  return porcelain.split(/\r?\n/).filter((line) => line.trim().length > 0)
    .length;
}
