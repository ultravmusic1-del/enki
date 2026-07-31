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
 * Minimum stylesheet rules a real page of this app has.
 *
 * Measured in real Chromium: `/` and `/tools` both load 305 rules, of which
 * 209 come from a single shared base/preflight chunk present on every route
 * regardless of route-specific class usage. That 209 is a structural floor,
 * not incidental purge drift -- shrinking it would take a deliberate change
 * to split that chunk per route, not a routine content or Tailwind update.
 * A genuinely unstyled page measures 0, and a partial stub lands far nearer
 * 0 than 150: a broken page does not half-load Tailwind's preflight layer,
 * it either gets the bundle or it doesn't.
 *
 * 150 sits comfortably below the 305/209 measurements, leaving room for
 * route-splitting or purge changes to move the count without a false abort,
 * while staying far above what an actually-broken page reports. The
 * asymmetry justifies buying that margin: a false abort is a loud,
 * one-line-diagnosable hiccup fixed by rerunning or bumping this constant;
 * the false pass it replaces is a shipped, undetected visual regression.
 */
const MIN_STYLE_RULES = 150;

/**
 * Fonts a browser falls back to when no stylesheet applied.
 *
 * The first alternative is anchored (`^...$`) because a real stack like
 * `Inter, sans-serif` must not match on the bare word "sans-serif" appearing
 * as a fallback entry. `times new roman` is deliberately left unanchored:
 * real Chromium reports it as `'"Times New Roman"'`, and it can also appear
 * as one entry inside a longer fallback stack, so anchoring it would miss
 * both. Anchoring it "to match the others" would look like a cleanup but
 * would silently stop catching the substring case.
 *
 * Platform caveat: "Times New Roman" is the Windows/Mac default serif
 * substitution. A headless Linux CI box may resolve the browser default to
 * something else entirely (e.g. Liberation Serif, Noto Serif), which this
 * regex would not catch. That is not a practical gap today because the
 * rule-count gate above already catches any genuinely unstyled page at 0
 * regardless of platform -- but it means the font check is not portable
 * proof on its own, and the rule-count gate should not be removed under the
 * assumption that the font check has Linux covered.
 */
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
 * Selects which routes to sweep from CLI argv, distinguishing "no routes
 * given" (fall back to the documented defaults) from "routes given that
 * could not be understood" (fail loudly).
 *
 * Git Bash rewrites a bare positional argument like `/tools` into a Windows
 * path (`C:/Program Files/Git/tools`) before Node ever sees it. That mangled
 * string does not start with "/", so a filter that just discarded
 * non-matching args would end up with zero routes and silently fall back to
 * the defaults -- `pnpm sweep -- /tools/cursor` from Git Bash would quietly
 * sweep `/` and `/tools` instead and still print "Sweep clean". That is the
 * same shape of bug as an unstyled-page false pass: the harness reports
 * success for work it did not do. The fix is to only default when the user
 * gave nothing at all; if they gave something and none (or not all) of it
 * survived, that is a malformed invocation and must fail, naming what came
 * through so it can be diagnosed.
 *
 * @param {string[]} argv
 * @returns {{ok: true, routes: string[]} | {ok: false, positionals: string[], unrecognized: string[]}}
 */
export function selectRoutes(argv) {
  const baseIndex = argv.indexOf("--base");
  // With no --base, baseIndex is -1, so a bare `index !== baseIndex + 1`
  // would silently drop the first positional argument.
  //
  // A literal "--" is also not a positional: `pnpm sweep -- --base URL /x`
  // forwards that separator through to argv verbatim rather than stripping
  // it (verified empirically), so it would otherwise be misdiagnosed as an
  // unrecognized route on every invocation that uses `--`.
  const positionals = argv.filter(
    (arg, index) =>
      arg !== "--" &&
      (baseIndex === -1 || (index !== baseIndex && index !== baseIndex + 1)),
  );

  if (positionals.length === 0) {
    return { ok: true, routes: ["/", "/tools"] };
  }

  const unrecognized = positionals.filter((arg) => !arg.startsWith("/"));
  if (unrecognized.length > 0) {
    return { ok: false, positionals, unrecognized };
  }

  return { ok: true, routes: positionals };
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
