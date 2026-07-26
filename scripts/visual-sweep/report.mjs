/**
 * Pure reporting half of the visual sweep, so the decision logic is testable
 * without booting a browser.
 */

/**
 * Console errors that say nothing about the page under test.
 *
 * Vercel Analytics and Speed Insights load their scripts from /_vercel/*, which
 * only exists on Vercel's edge. Against a local production server (`next start`)
 * they 404 on every route, and the sweep would fail everything for a reason that
 * has nothing to do with the app. The 404 line itself carries no URL in its
 * text, so the console message's location is checked too.
 */
const ENVIRONMENTAL_URL = /\/_vercel\//;

/** @param {{text?: string, url?: string}} message */
export function isIgnorableConsoleError({ text = "", url = "" }) {
  return ENVIRONMENTAL_URL.test(url) || ENVIRONMENTAL_URL.test(text);
}

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
