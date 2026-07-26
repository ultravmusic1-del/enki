/**
 * Pure reporting half of the visual sweep, so the decision logic is testable
 * without booting a browser.
 */

/** Collapse duplicate container/child pairs, which repeat across list items. */
export function dedupeProblems(problems) {
  const seen = new Set();
  return problems.filter((problem) => {
    const key = `${problem.container}>>${problem.child}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {Array<{
 *   route: string,
 *   viewport: string,
 *   consoleErrors: string[],
 *   problems: object[],
 * }>} results
 */
export function summarize(results) {
  const failures = results.filter(
    (result) => result.consoleErrors.length > 0 || result.problems.length > 0,
  );
  return { ok: failures.length === 0, failureCount: failures.length, failures };
}
