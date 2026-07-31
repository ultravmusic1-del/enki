#!/usr/bin/env node
/**
 * Build src/app/favicon.ico from the brand emblem.
 *
 * Google's SERP favicon fetcher requests /favicon.ico by path and does not
 * fall back to icon.svg, so a site with only an SVG icon shows a blank square
 * next to every search result. Multi-size because Windows and some feed
 * readers pick 16 or 32 rather than scaling the largest.
 *
 * Source is public/icon.svg (not src/app/icon.svg — the brand mark lives in
 * public/ alongside apple-icon.tsx's copy of the same path data), which is
 * the same 32x32 teal-sparkle-on-dark-tile emblem referenced from
 * layout.tsx's metadata.icons.
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const SOURCE = "public/icon.svg";
const OUT = "src/app/favicon.ico";
const SIZES = [16, 32, 48];

const svg = await readFile(SOURCE);
const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp(svg, { density: 384 }).resize(size, size).png().toBuffer(),
  ),
);

await writeFile(OUT, await pngToIco(pngs));
console.log(`favicon.ico <- ${SOURCE} (${SIZES.join(", ")}px)`);
