/**
 * Dependency freshness. A pull that changes pnpm-lock.yaml leaves node_modules
 * behind until the next install, which surfaces as bizarre missing-module
 * errors rather than an obvious "run pnpm install".
 */

/**
 * @param {{lockMtimeMs: number, modulesMtimeMs: number | null}} input
 *   modulesMtimeMs is null when node_modules/.modules.yaml is absent.
 */
export function isDepsStale({ lockMtimeMs, modulesMtimeMs }) {
  if (modulesMtimeMs === null) return true;
  return lockMtimeMs > modulesMtimeMs;
}
