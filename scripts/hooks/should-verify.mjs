/**
 * Whether a staged change is worth the ~30s gate.
 *
 * Enki's history is roughly a third documentation commits. Paying for a full
 * typecheck/lint/test run to commit a handoff edit trains people to reach for
 * --no-verify, which is worse than a slightly narrower gate.
 */
const CODE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|sass|json)$/i;

/** @param {string[]} stagedFiles Repo-relative paths from `git diff --cached`. */
export function shouldVerify(stagedFiles) {
  return stagedFiles.some((file) => CODE_PATTERN.test(file));
}
