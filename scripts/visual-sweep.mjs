#!/usr/bin/env node
/**
 * `pnpm sweep` — the Visual Sweep from CLAUDE.md, as a command.
 *
 * Loads each route in a real Chromium at a narrow and a wide viewport, then
 * proves three things: the console is clean, the page does not scroll
 * horizontally, and nothing overflows a container that clips.
 *
 * That last check is the generalized form of the bug this rule exists for: a
 * pricing badge overflowed its card, `overflow-hidden` clipped it, and the
 * rendered HTML looked perfectly fine. Measuring child.right against
 * container.right is what catches it.
 *
 * Intentional clipping (carousels, marquees) is opted out with a
 * `data-sweep-ignore` attribute on the clipping container.
 *
 * Usage:
 *   pnpm sweep                                  # / and /tools
 *   pnpm sweep -- /tools/cursor /best/writing   # explicit routes
 *   pnpm sweep -- --base http://localhost:3100 /
 *
 * On Git Bash, bare routes like `/tools` get rewritten into Windows paths
 * (`C:/Program Files/Git/tools`) before Node ever sees them -- `--` does not
 * stop this, it only stops option parsing. Set MSYS_NO_PATHCONV=1 to pass
 * explicit routes from Git Bash:
 *   MSYS_NO_PATHCONV=1 pnpm sweep -- --base http://localhost:3100 /tools/cursor
 */
import { chromium } from "@playwright/test";
import {
  dedupeProblems,
  isIgnorableConsoleError,
  isStyled,
  selectRoutes,
  summarize,
} from "./visual-sweep/report.mjs";

const VIEWPORTS = [
  { name: "narrow", width: 390, height: 844 },
  { name: "wide", width: 1440, height: 900 },
];

const argv = process.argv.slice(2);
const baseIndex = argv.indexOf("--base");
const base = baseIndex === -1 ? "http://localhost:3000" : argv[baseIndex + 1];

const selection = selectRoutes(argv);
if (!selection.ok) {
  // Falling back to the defaults here would be the same bug this file
  // already guards against for unstyled pages: the harness would sweep the
  // wrong routes and still print "Sweep clean," reporting success for work
  // it did not do. Fail loudly and name what was actually received instead.
  console.error(
    `\nCould not parse route arguments: ${JSON.stringify(selection.positionals)}`,
  );
  console.error(
    `  Not recognized as a route (must start with "/"): ${selection.unrecognized
      .map((arg) => JSON.stringify(arg))
      .join(", ")}`,
  );
  console.error(
    `  This is almost always Git Bash rewriting a bare argument like /tools\n` +
      `  into a Windows path before Node ever sees it. Fix by re-running with:\n` +
      `    MSYS_NO_PATHCONV=1 pnpm sweep -- --base ${base} ...\n`,
  );
  process.exit(1);
}
const targets = selection.routes;

/**
 * Find children escaping a clipping container. Runs in page context, so it is
 * written as a self-contained function body with no imports.
 */
const CLIP_PROBE = () => {
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const problems = [];

  for (const el of document.querySelectorAll("*")) {
    if (el.closest("[data-sweep-ignore]")) continue;

    const style = getComputedStyle(el);
    if (!/hidden|clip/.test(style.overflowX)) continue;

    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    for (const child of el.querySelectorAll("*")) {
      // data-sweep-ignore exempts a whole subtree, so a child inside an ignored
      // wrapper is exempt even when measured against an outer container.
      if (child.closest("[data-sweep-ignore]")) continue;

      const childBox = child.getBoundingClientRect();
      if (childBox.width === 0 || childBox.height === 0) continue;

      // Only in-flow children. Absolute, fixed, and sticky elements are removed
      // from normal layout deliberately, and Enki's atmosphere is built from
      // oversized absolutely-positioned blurs that their container is *meant*
      // to clip. The bug this check exists for -- a pricing badge overflowing
      // its card -- was in-flow content in a flex row.
      const childPosition = getComputedStyle(child).position;
      if (childPosition !== "static" && childPosition !== "relative") continue;

      const overflowRight = childBox.right - box.right;
      const overflowLeft = box.left - childBox.left;

      if (overflowRight > 1 || overflowLeft > 1) {
        problems.push({
          container: describe(el),
          child: describe(child),
          overflowRight: Math.round(overflowRight),
          overflowLeft: Math.round(overflowLeft),
        });
      }
    }
  }

  return problems;
};

const browser = await chromium.launch();
const results = [];

for (const route of targets) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // The bare "Failed to load resource" line names no URL, so the request
      // location is what identifies which asset actually failed.
      const url = message.location()?.url ?? "";
      if (isIgnorableConsoleError({ text, url })) return;
      consoleErrors.push(text);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    const url = `${base}${route}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    } catch (error) {
      console.error(`\nCould not load ${url}`);
      console.error(`  ${error.message}`);
      console.error(`  Is the server running? Try: pnpm dev\n`);
      await browser.close();
      process.exit(1);
    }

    // Let entrance animations settle before measuring.
    await page.waitForTimeout(600);

    // Every check below is vacuous without CSS: CLIP_PROBE only inspects
    // elements whose computed overflowX clips, and with no stylesheet nothing
    // does, so it finds no containers and reports no problems. A stale
    // process squatting on the sweep port serving unstyled HTML would pass
    // silently otherwise -- this is what caught that.
    const styling = await page.evaluate(() => ({
      ruleCount: Array.from(document.styleSheets).reduce((total, sheet) => {
        // A cross-origin sheet throws on .cssRules; it is not ours anyway.
        try {
          return total + sheet.cssRules.length;
        } catch {
          return total;
        }
      }, 0),
      fontFamily: getComputedStyle(document.body).fontFamily,
    }));

    if (!isStyled(styling)) {
      console.error(`\nSweep target is not styled: ${url}`);
      console.error(
        `  ${styling.ruleCount} CSS rules, body font-family "${styling.fontFamily}"`,
      );
      console.error(
        `  Every check here is vacuous without CSS, so this would have passed\n` +
          `  while proving nothing. Usually a stale process on the port, or a\n` +
          `  server that has not finished building. Check what is on ${base}.\n`,
      );
      await browser.close();
      process.exit(1);
    }

    const problems = dedupeProblems(await page.evaluate(CLIP_PROBE));

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (documentOverflow > 1) {
      problems.push({
        container: "document",
        child: "(page)",
        overflowRight: documentOverflow,
        overflowLeft: 0,
      });
    }

    results.push({ route, viewport: viewport.name, consoleErrors, problems });

    await context.close();
  }
}

await browser.close();

const summary = summarize(results);

console.log(`\nVisual sweep — ${base}\n`);
for (const result of results) {
  const clean =
    result.consoleErrors.length === 0 && result.problems.length === 0;
  console.log(
    `  ${clean ? "PASS" : "FAIL"}  ${result.route} @ ${result.viewport}`,
  );
  for (const error of result.consoleErrors) {
    console.log(`          console: ${error}`);
  }
  for (const problem of result.problems) {
    const direction =
      problem.overflowRight > 1
        ? `${problem.overflowRight}px past the right edge`
        : `${problem.overflowLeft}px past the left edge`;
    console.log(
      `          ${problem.child} escapes ${problem.container} by ${direction}`,
    );
  }
}

console.log(
  summary.ok
    ? "\nSweep clean.\n"
    : `\n${summary.failureCount} route/viewport combination(s) failed.\n`,
);

process.exit(summary.ok ? 0 : 1);
