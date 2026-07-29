#!/usr/bin/env node
/**
 * `pnpm optimize:brand` — shrink the emblem mask.
 *
 * The `.emblem` utility in globals.css uses this purely as a CSS mask, and a CSS
 * mask reads ONLY the alpha channel. The source was 815x815 RGBA at 415 KB, so
 * three of its four channels were downloaded and decoded on every page load and
 * then thrown away — for a mark that renders at 24 px in the site header.
 *
 * Output is a 512x512 palette PNG — still comfortably 2x the largest on-screen
 * usage. Greyscaling alone only got to 156 KB because sharp keeps four channels
 * whenever alpha is present; quantising to a palette is what does the work, and
 * a mask's colour data is meaningless anyway. Alpha is preserved, so `mask` in
 * globals.css keeps working with no CSS change.
 *
 * Extracting alpha to a single channel was measured too (111 KB) and is both
 * larger and would require switching the mask to luminance mode.
 *
 * Re-runnable; the source is never modified.
 */
import sharp from "sharp";
import { statSync } from "node:fs";

const SRC = "assets/brand/logo-mask.source.png";
const OUT = "public/brand/logo-mask.png";

await sharp(SRC)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .greyscale()
  .png({ compressionLevel: 9, palette: true, colors: 64 })
  .toFile(OUT);

const before = statSync(SRC).size;
const after = statSync(OUT).size;
console.log("optimize:brand");
console.log(
  `  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
    `(${(before / after).toFixed(1)}x smaller)`,
);
