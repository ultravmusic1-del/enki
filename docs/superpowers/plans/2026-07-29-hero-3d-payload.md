# Hero 3D Payload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hero's 3D oracle arrive quickly, and replace the flat emblem
placeholder with one that matches the model so the handover is invisible.

**Architecture:** Three independent levers, each measured before being chosen — shrink
the model, stop the download being serialised behind the 3D chunk, and replace the
placeholder. Asset processing lives in re-runnable `scripts/*.mjs` with the unoptimised
source kept out of `public/`.

**Tech Stack:** Next.js 16, React 19, three.js / R3F, @gltf-transform + meshoptimizer,
sharp, Playwright.

---

## Measured baseline

Production, throttled cold load (~1.6 Mbps):

| Observation | Value |
|---|---|
| Geometry | 200,000 triangles → 1.19 MB (93% of file) |
| Textures | 93 KB WebP + `TEXCOORD_0`, all discarded at runtime |
| 3D chunk (three + R3F + drei) done | 9.7 s |
| `.glb` done | **14.8 s** — cannot start until the chunk executes |
| `logo-mask.png` done | 9.6 s — 415 KB, 815×815 **RGBA** for an alpha-only mask |
| `logo-mask.png` usages | 11, including the 24 px header logo on every page |

Decimation spike, rendered in the real hero and compared visually:

| Ratio | Triangles | Size (meshopt) | Verdict |
|---|---|---|---|
| current | 200,000 | 1286 KB | baseline |
| 0.30 | 60,000 | 341 KB | — |
| 0.15 | 30,000 | 181 KB | — |
| **0.10** | **20,000** | **124 KB** | **indistinguishable at hero scale — chosen** |

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `assets/models/enki-model.source.glb` | Create | Unoptimised original, never served |
| `scripts/optimize-model.mjs` | Create | Source → optimised `public/models/enki-model.glb` |
| `public/models/enki-model.glb` | Regenerate | 124 KB, 20k tris |
| `scripts/optimize-brand-assets.mjs` | Create | Shrinks `logo-mask.png` |
| `public/brand/logo-mask.png` | Regenerate | Alpha-only, 512², far smaller |
| `scripts/render-poster.mjs` | Create | Captures the poster from the live model |
| `public/brand/oracle-poster.webp` | Create | Placeholder that matches the model |
| `src/components/home/oracle-model.tsx` | Modify | Poster placeholder + crossfade |
| `src/components/home/oracle-model-scene.tsx` | Modify | `onReady` when the model is drawable |
| `src/app/page.tsx` | Modify | `<link rel="preload">` for the `.glb` |
| `package.json` | Modify | `optimize:model`, `optimize:brand`, `poster` scripts |

---

## Task 1: Preserve the source model

**Files:** `assets/models/enki-model.source.glb` (create)

- [ ] **Step 1: Move the original out of `public/`**

```bash
mkdir -p assets/models
git mv public/models/enki-model.glb assets/models/enki-model.source.glb
```

Nothing may serve the unoptimised model. `public/models/enki-model.glb` is regenerated
in Task 2 and committed, so the deployed artefact is reproducible from the source.

- [ ] **Step 2: Verify**

```bash
ls -l assets/models/enki-model.source.glb
```

Expected: ~1.3 MB present. `public/models/` is now empty of the glb until Task 2.

---

## Task 2: The model optimiser

**Files:** `scripts/optimize-model.mjs` (create), `package.json` (modify)

- [ ] **Step 1: Write the script**

Create `scripts/optimize-model.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm optimize:model` — rebuild the served hero model from its source.
 *
 * The source is a 200k-triangle bas-relief with two embedded WebP textures. The
 * hero replaces every material with a single teal MeshStandardMaterial at
 * runtime (see oracle-model-scene.tsx), so the textures and their UVs are
 * downloaded and then discarded. They are stripped here.
 *
 * Geometry is the real weight: 1.19 MB of the 1.29 MB file. At hero scale the
 * relief sits behind the headline under a scrim, and a 10% decimation was
 * compared against the original in a real browser and judged indistinguishable.
 *
 * Re-runnable and deterministic: the source is never modified.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  reorder,
  simplify,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { statSync } from "node:fs";

const SRC = "assets/models/enki-model.source.glb";
const OUT = "public/models/enki-model.glb";
/** Chosen by rendering candidates in the real hero and comparing. */
const RATIO = 0.1;

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const doc = await io.read(SRC);

// Drop material texture references first so `prune` can remove the images.
for (const mat of doc.getRoot().listMaterials()) {
  mat.setBaseColorTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setNormalTexture(null);
  mat.setEmissiveTexture(null);
  mat.setOcclusionTexture(null);
}
// UVs only existed to sample those textures.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const semantic of prim.listSemantics()) {
      if (semantic.startsWith("TEXCOORD")) prim.setAttribute(semantic, null);
    }
  }
}

await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.001 }),
  prune(),
  dedup(),
  reorder({ encoder: MeshoptEncoder }),
  quantize(),
);

doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

await io.write(OUT, doc);

let triangles = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    triangles +=
      (indices ? indices.getCount() : prim.getAttribute("POSITION").getCount()) / 3;
  }
}

const before = statSync(SRC).size;
const after = statSync(OUT).size;
console.log(`optimize:model`);
console.log(`  triangles: ${Math.round(triangles).toLocaleString()}`);
console.log(
  `  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
    `(${(before / after).toFixed(1)}x smaller)`,
);
```

- [ ] **Step 2: Add the package script**

In `package.json`, after the `sweep` line:

```json
    "optimize:model": "node scripts/optimize-model.mjs",
```

- [ ] **Step 3: Run it**

```bash
pnpm optimize:model
```

Expected: `triangles: 20,000` (approximately) and `1286KB -> 124KB (10.4x smaller)`.

- [ ] **Step 4: Commit**

```bash
git add assets/models scripts/optimize-model.mjs public/models/enki-model.glb package.json
git commit -m "perf(hero): decimate the oracle model from 200k to 20k triangles"
```

---

## Task 3: Stop the download being serialised

**Files:** `src/app/page.tsx` (modify)

- [ ] **Step 1: Preload the model alongside the JS**

At the top of the returned JSX in `src/app/page.tsx`, add:

```tsx
{/* The 3D chunk imports the model, so without this the .glb cannot even start
    downloading until ~900KB of three.js has arrived and executed — measured at
    9.7s to 14.8s on a throttled cold load. Preloading overlaps the two.
    No crossOrigin: three fetches this same-origin without CORS, and a mismatch
    here would cause the browser to download it twice. */}
<link
  rel="preload"
  href="/models/enki-model.glb"
  as="fetch"
  type="model/gltf-binary"
/>
```

React 19 hoists `<link>` into `<head>`.

- [ ] **Step 2: Verify it is not double-fetched**

Build, serve, and check the waterfall shows exactly one request for the model. A
duplicate means the preload's request mode does not match three's fetch.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "perf(hero): preload the model instead of waiting on the 3D chunk"
```

---

## Task 4: Shrink the brand mask

**Files:** `scripts/optimize-brand-assets.mjs` (create), `public/brand/logo-mask.png`, `package.json`

- [ ] **Step 1: Write the script**

Create `scripts/optimize-brand-assets.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm optimize:brand` — shrink the emblem mask.
 *
 * `.emblem` (globals.css) uses this purely as a CSS mask, and a CSS mask reads
 * ONLY the alpha channel. The source was 815x815 RGBA at 415 KB, so three of its
 * four channels were decoded and thrown away — on every page, for a logo that
 * renders at 24 px in the header.
 *
 * Output is greyscale + alpha at 512x512, which is still 2x the largest usage.
 */
import sharp from "sharp";
import { statSync } from "node:fs";

const SRC = "assets/brand/logo-mask.source.png";
const OUT = "public/brand/logo-mask.png";

await sharp(SRC)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .greyscale()
  .png({ compressionLevel: 9, palette: false })
  .toFile(OUT);

const before = statSync(SRC).size;
const after = statSync(OUT).size;
console.log(
  `optimize:brand\n  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
    `(${(before / after).toFixed(1)}x smaller)`,
);
```

- [ ] **Step 2: Move the source and add the script entry**

```bash
mkdir -p assets/brand
git mv public/brand/logo-mask.png assets/brand/logo-mask.source.png
```

In `package.json`, after `optimize:model`:

```json
    "optimize:brand": "node scripts/optimize-brand-assets.mjs",
```

- [ ] **Step 3: Run and check the emblem still renders**

```bash
pnpm optimize:brand
```

Expected: a substantial reduction from 415 KB. The mask must still be visually
identical wherever `.emblem` is used — verified by the sweep in Task 7.

- [ ] **Step 4: Commit**

```bash
git add assets/brand scripts/optimize-brand-assets.mjs public/brand/logo-mask.png package.json
git commit -m "perf(brand): alpha-only emblem mask instead of 415KB RGBA"
```

---

## Task 5: A placeholder that matches the model

**Files:** `scripts/render-poster.mjs` (create), `public/brand/oracle-poster.webp` (create), `package.json`

- [ ] **Step 1: Write the poster renderer**

Create `scripts/render-poster.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm poster` — capture the hero placeholder from the live model.
 *
 * Requires a server already running (default http://localhost:3000). Pass a
 * different origin as the first argument.
 *
 * The placeholder used to be the flat emblem mask, which reads as a 2D logo
 * where a 3D relief belongs. Rendering the actual model means the handover to
 * WebGL is a dissolve between two near-identical images.
 *
 * `reducedMotion: "reduce"` matters: the scene pins the model to its canonical
 * pose in that mode (see oracle-model-scene.tsx), so this is deterministic and
 * matches the pose the live model springs from.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { statSync } from "node:fs";

const ORIGIN = process.argv[2] ?? "http://localhost:3000";
const OUT = "public/brand/oracle-poster.webp";

const browser = await chromium.launch();
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
if (!modelLoaded) throw new Error("model never loaded — is the server running?");
await page.waitForTimeout(3000);

// Isolate the canvas: everything else would bake into the poster.
await page.addStyleTag({
  content: `.grain, [data-hero-reveal], header, footer,
            section > div[aria-hidden]:not([data-halo]) { visibility: hidden !important; }
            body { background: transparent !important; }`,
});
await page.waitForTimeout(400);

const png = await page.locator("canvas").screenshot({ omitBackground: true });
await browser.close();

await sharp(png).trim().webp({ quality: 82, alphaQuality: 90 }).toFile(OUT);
console.log(`poster\n  ${OUT}  ${(statSync(OUT).size / 1024).toFixed(0)}KB`);
```

- [ ] **Step 2: Add the script entry**

```json
    "poster": "node scripts/render-poster.mjs",
```

- [ ] **Step 3: Generate it**

Build and serve, then:

```bash
pnpm poster
```

Expected: a transparent WebP of the teal relief, well under 100 KB.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-poster.mjs public/brand/oracle-poster.webp package.json
git commit -m "feat(hero): render the placeholder from the model itself"
```

---

## Task 6: Use the poster, and dissolve it out

**Files:** `src/components/home/oracle-model.tsx`, `src/components/home/oracle-model-scene.tsx`

- [ ] **Step 1: Signal when the model is drawable**

In `oracle-model-scene.tsx`, give `OracleTablet` and `OracleModelScene` an `onReady`
callback. `OracleTablet` only renders once `useGLTF` has resolved, so firing an effect
there is the correct signal:

```tsx
useEffect(() => {
  onReady?.();
}, [onReady]);
```

Thread it through `OracleModelScene({ active, onReady })` to `<OracleTablet …
onReady={onReady} />`.

- [ ] **Step 2: Replace the emblem fallback with the poster**

In `oracle-model.tsx`, replace `EmblemFallback` with a poster that covers the same box
and fades out once the scene reports ready. The poster stays mounted through the
crossfade so there is never a frame with neither.

- [ ] **Step 3: Verify**

```bash
pnpm verify
```

- [ ] **Step 4: Commit**

```bash
git add src/components/home/oracle-model.tsx src/components/home/oracle-model-scene.tsx
git commit -m "feat(hero): dissolve the poster into the live model"
```

---

## Task 7: Verification

- [ ] **Step 1: Gate + build**

```bash
pnpm verify
pnpm build
```

- [ ] **Step 2: Visual sweep** — `.tsx` and asset changes

```bash
pnpm sweep -- / /tools
```

Expected: PASS at both viewports, zero console errors.

- [ ] **Step 3: Waterfall, throttled cold load**

Re-measure against the production build. Expected versus the baseline above:

| Metric | Before | Target |
|---|---|---|
| `.glb` size | 1286 KB | ~124 KB |
| `.glb` complete | 14.8 s | materially earlier, and overlapping the JS |
| `logo-mask.png` | 415 KB | far smaller |
| Requests for the model | 1 | exactly 1 (no preload duplicate) |

- [ ] **Step 4: Confirm the hero still looks right**

Screenshot the loaded hero and compare against `tmp-shots/original.png` from the spike.
The relief must read the same.

---

## Out of scope

- The 909 KB three.js/R3F chunk itself. Splitting or replacing it is a much larger
  change; this plan makes the model stop waiting on it rather than shrinking it.
- `public/brand/logo.png` (1.1 MB) and `inspiration.png` (500 KB). Neither is on the
  homepage critical path — `logo.png` backs the OG image, which is fetched by crawlers
  rather than visitors. Worth a separate pass.
