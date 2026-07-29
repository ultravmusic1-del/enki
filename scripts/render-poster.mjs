#!/usr/bin/env node
/**
 * `pnpm poster` — capture the hero placeholder from the live model.
 *
 * Requires a server already running (default http://localhost:3000); pass a
 * different origin as the first argument.
 *
 * The placeholder used to be the flat emblem mask, which reads as a 2D logo
 * where a 3D relief belongs. Rendering the actual model means the handover to
 * WebGL is a dissolve between two near-identical images rather than a swap
 * between two different marks.
 *
 * `reducedMotion: "reduce"` is load-bearing: in that mode the scene pins the
 * model to its canonical pose (see oracle-model-scene.tsx) instead of drifting,
 * so this is deterministic and matches the pose the live model springs from.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { statSync } from "node:fs";

const ORIGIN = process.argv[2] ?? "http://localhost:3000";
const OUT = "public/brand/oracle-poster.webp";

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  let modelLoaded = false;
  page.on("response", (r) => {
    if (r.url().includes("enki-model.glb")) modelLoaded = true;
  });

  await page.goto(ORIGIN, { waitUntil: "load" });
  for (let i = 0; i < 80 && !modelLoaded; i++) await page.waitForTimeout(250);
  if (!modelLoaded) {
    throw new Error(`model never loaded from ${ORIGIN} — is the server running?`);
  }
  await page.waitForTimeout(3000); // let the first frames settle

  // Everything else would bake into the poster.
  await page.addStyleTag({
    content: `
      .grain, header, footer, [data-hero-reveal] { visibility: hidden !important; }
      body { background: transparent !important; }
    `,
  });
  await page.waitForTimeout(400);

  const png = await page.locator("canvas").screenshot({ omitBackground: true });

  // The raw capture is 2560x1440 and ~215KB, which defeats the point of a
  // placeholder. The relief renders around 500px wide behind a scrim, so 900px
  // still covers a 2x display, and this lands near the size of the emblem mask
  // it replaces.
  await sharp(png)
    .trim()
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 85 })
    .toFile(OUT);

  console.log("poster");
  console.log(`  ${OUT}  ${(statSync(OUT).size / 1024).toFixed(0)}KB`);
} finally {
  await browser.close();
}
