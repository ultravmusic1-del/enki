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
 */
const WRITE_ORDER_TOLERANCE_MS = 5_000;

/**
 * @param {{
 *   lockMtimeMs: number,
 *   modulesMtimeMs: number | null,
 *   toleranceMs?: number,
 * }} input
 *   modulesMtimeMs is null when node_modules/.modules.yaml is absent.
 */
export function isDepsStale({
  lockMtimeMs,
  modulesMtimeMs,
  toleranceMs = WRITE_ORDER_TOLERANCE_MS,
}) {
  if (modulesMtimeMs === null) return true;
  return lockMtimeMs - modulesMtimeMs > toleranceMs;
}
