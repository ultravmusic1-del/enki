/**
 * Toolchain parity between machines. package.json is the single source of
 * truth: `engines.node` for the runtime, `packageManager` for pnpm.
 */

/** Major version number from a version string, with or without a v prefix. */
export function majorOf(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

/** @param {{engines?: {node?: string}}} pkg */
export function expectedNodeMajor(pkg) {
  const match = /(\d+)/.exec(pkg.engines?.node ?? "");
  return match ? Number(match[1]) : null;
}

/** @param {{packageManager?: string}} pkg */
export function expectedPnpmVersion(pkg) {
  const match = /^pnpm@(\d+\.\d+\.\d+)/.exec(pkg.packageManager ?? "");
  return match ? match[1] : null;
}
