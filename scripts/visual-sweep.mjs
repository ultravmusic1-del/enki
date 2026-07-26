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
 */
import { chromium } from "@playwright/test";
import { dedupeProblems, summarize } from "./visual-sweep/report.mjs";

const VIEWPORTS = [
  { name: "narrow", width: 390, height: 844 },
  { name: "wide", width: 1440, height: 900 },
];

const argv = process.argv.slice(2);
const baseIndex = argv.indexOf("--base");
const base = baseIndex === -1 ? "http://localhost:3000" : argv[baseIndex + 1];
// The baseIndex exclusion has to be guarded: with no --base, baseIndex is -1,
// so a bare `index !== baseIndex + 1` would silently drop the first route.
const routes = argv.filter(
  (arg, index) =>
    arg.startsWith("/") &&
    (baseIndex === -1 || (index !== baseIndex && index !== baseIndex + 1)),
);
const targets = routes.length > 0 ? routes : ["/", "/tools"];

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
      if (message.type() === "error") consoleErrors.push(message.text());
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
