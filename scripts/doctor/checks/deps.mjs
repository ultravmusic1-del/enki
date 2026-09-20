/**
 * Dependency freshness. A pull that changes pnpm-lock.yaml leaves node_modules
 * behind until the next install, which surfaces as bizarre missing-module
 * errors rather than an obvious "run pnpm install".
 */

/**
 * A single install writes .modules.yaml and then the lockfile, so on a
 * perfectly healthy tree the lockfile is a fraction of a second newer. Without
 * a tolerance the check fires after every install that touches the lockfile,
 * and a check that always cries wolf is worse than no check.
 *
 * This tolerance is only a fallback now (see isDepsStale below): an install
 * that takes longer than it to write .modules.yaml and then pnpm-lock.yaml
 * still trips it, which is exactly the false FAIL that motivated comparing
 * lockfile content directly when we can.
 */
const WRITE_ORDER_TOLERANCE_MS = 5_000;

/**
 * pnpm writes a copy of the resolved lockfile to
 * node_modules/.pnpm/lock.yaml. Comparing it against the repo's
 * pnpm-lock.yaml tells us, exactly, whether the last install matches the
 * lockfile currently checked out — no timing guesses. CRLF is stripped
 * before comparing because the repo file has CRLF line endings and pnpm's
 * copy does not; that alone is not drift.
 *
 * @param {string | null | undefined} repoLock
 * @param {string | null | undefined} installedLock
 */
export function lockfilesMatch(repoLock, installedLock) {
  if (repoLock == null || installedLock == null) return false;
  return repoLock.replace(/\r/g, "") === installedLock.replace(/\r/g, "");
}

/**
 * @param {{
 *   lockMtimeMs: number,
 *   modulesMtimeMs: number | null,
 *   repoLock?: string | null,
 *   installedLock?: string | null,
 *   toleranceMs?: number,
 * }} input
 *   modulesMtimeMs is null when node_modules/.modules.yaml is absent.
 *   installedLock is the content of node_modules/.pnpm/lock.yaml, or
 *   null/undefined when that copy doesn't exist (e.g. an older pnpm, or no
 *   install yet) — in which case we fall back to the mtime comparison.
 */
export function isDepsStale({
  lockMtimeMs,
  modulesMtimeMs,
  repoLock,
  installedLock,
  toleranceMs = WRITE_ORDER_TOLERANCE_MS,
}) {
  if (modulesMtimeMs === null) return true;

  if (installedLock !== null && installedLock !== undefined) {
    return !lockfilesMatch(repoLock, installedLock);
  }

  return lockMtimeMs - modulesMtimeMs > toleranceMs;
}
