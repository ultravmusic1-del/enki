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
 * Minimum stylesheet rules a real page of this app has. Tailwind emits
 * hundreds for any route; a stub or error page emits a handful.
 */
const MIN_STYLE_RULES = 200;

/** Fonts a browser falls back to when no stylesheet applied. */
const DEFAULT_FONT = /^\s*(serif|sans-serif|monospace)\s*$|times new roman/i;

/**
 * Whether the page under test is actually styled.
 *
 * Every check this harness makes is vacuous without CSS: CLIP_PROBE only
 * inspects elements whose computed overflowX clips, and with no stylesheet
 * nothing does, so it finds no containers and reports no problems. A sweep
 * against an unstyled page prints "Sweep clean" and proves nothing.
 *
 * That happened: a stale process squatting on the sweep port served unstyled
 * HTML, and the measurements taken against it looked perfectly healthy.
 *
 * @param {{ruleCount: number, fontFamily: string}} page
 */
export function isStyled({ ruleCount, fontFamily }) {
  if (ruleCount < MIN_STYLE_RULES) return false;
  return !DEFAULT_FONT.test(fontFamily);
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
