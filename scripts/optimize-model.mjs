#!/usr/bin/env node
/**
 * `pnpm optimize:model` — rebuild the served hero model from its source.
 *
 * The source is a 200k-triangle bas-relief carrying two embedded WebP textures.
 * The hero replaces every material with a single teal MeshStandardMaterial at
 * runtime (see oracle-model-scene.tsx), so those textures and the UVs that
 * address them are downloaded and then discarded. They are stripped here.
 *
 * Geometry is the real weight: 1.19 MB of the 1.29 MB file. At hero scale the
 * relief sits behind the headline under a scrim, and a 10% decimation was
 * rendered against the original in a real browser and judged indistinguishable.
 *
 * Re-runnable and deterministic; the source is never modified.
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
/** Chosen by rendering candidates in the real hero and comparing them. */
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

// Drop the material's texture references first so `prune` can remove the images.
for (const mat of doc.getRoot().listMaterials()) {
  mat.setBaseColorTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setNormalTexture(null);
  mat.setEmissiveTexture(null);
  mat.setOcclusionTexture(null);
}
// The UVs existed only to sample those textures.
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
console.log("optimize:model");
console.log(`  triangles: ${Math.round(triangles).toLocaleString()}`);
console.log(
  `  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
    `(${(before / after).toFixed(1)}x smaller)`,
);
