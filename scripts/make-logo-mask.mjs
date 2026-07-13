// Converts the brand logo (teal mask on solid black, RGB) into an alpha mask:
// a white silhouette whose alpha follows source brightness. This lets us tint
// the emblem to any brand color via CSS mask-image + background-color, and it
// composites cleanly on both dark and light themes.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const src = PNG.sync.read(readFileSync("public/brand/logo.png"));
const { width, height } = src;

// Find the tight bounding box of non-black pixels so the emblem fills its frame.
let minX = width, minY = height, maxX = 0, maxY = 0;
const bright = new Float32Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) << 2;
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    // Perceptual-ish luminance; teal reads brightest, black -> 0.
    const lum = Math.min(1, (0.25 * r + 0.6 * g + 0.55 * b) / 200);
    bright[y * width + x] = lum;
    if (lum > 0.12) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad);
maxY = Math.min(height - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const size = Math.max(cw, ch);
const offX = Math.floor((size - cw) / 2);
const offY = Math.floor((size - ch) / 2);

const out = new PNG({ width: size, height: size });
out.data.fill(0);
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const a = Math.round(Math.min(1, bright[(minY + y) * width + (minX + x)]) * 255);
    const o = ((y + offY) * size + (x + offX)) << 2;
    out.data[o] = 255;
    out.data[o + 1] = 255;
    out.data[o + 2] = 255;
    out.data[o + 3] = a;
  }
}

writeFileSync("public/brand/logo-mask.png", PNG.sync.write(out));
console.log(`logo-mask.png written: ${size}x${size} (cropped from ${width}x${height})`);
