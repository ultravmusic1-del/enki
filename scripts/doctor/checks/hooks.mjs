/**
 * Hook wiring. .git/hooks is never pushed, so the only hooks that survive a
 * machine switch are the ones in .githooks that core.hooksPath points at.
 */

export const HOOKS_PATH = ".githooks";

/** @param {string} configured Raw `git config core.hooksPath` output. */
export function isHooksPathConfigured(configured) {
  return configured.trim() === HOOKS_PATH;
}
