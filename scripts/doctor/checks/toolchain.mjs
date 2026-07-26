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

/**
 * The running pnpm version, read from the user agent pnpm sets for its own
 * scripts (e.g. "pnpm/11.12.0 npm/? node/v24.14.1 win32 x64").
 *
 * Reading the env var beats spawning `pnpm --version`: on Windows pnpm is a
 * .cmd shim that execFileSync cannot resolve by bare name, and going through a
 * shell to reach it mangles arguments containing spaces.
 *
 * @param {string | undefined} userAgent Normally process.env.npm_config_user_agent.
 * @returns {string | null} null when not invoked through pnpm.
 */
export function parseUserAgentPnpm(userAgent) {
  const match = /\bpnpm\/(\d+\.\d+\.\d+)/.exec(userAgent ?? "");
  return match ? match[1] : null;
}
