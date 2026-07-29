import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  assertSubmittable,
  buildSubmission,
  keyLocation,
} from "@/lib/indexnow";

describe("indexnow key", () => {
  it("satisfies the protocol's format rule", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });

  it("resolves the key file against the canonical origin", () => {
    expect(keyLocation()).toBe(`https://enkitools.com/${INDEXNOW_KEY}.txt`);
  });
});

describe("assertSubmittable", () => {
  it("accepts URLs on the canonical host", () => {
    expect(() =>
      assertSubmittable([
        "https://enkitools.com/",
        "https://enkitools.com/tools/cursor",
      ]),
    ).not.toThrow();
  });

  it("rejects a foreign host", () => {
    expect(() => assertSubmittable(["https://example.com/tools"])).toThrow(
      /enkitools\.com/,
    );
  });

  // The regression the domain migration existed to prevent: a stale Vercel URL
  // must never be submitted. IndexNow would reject it anyway, because the key
  // file does not live on that host — failing here gives a clearer message.
  it("rejects the old vercel origin", () => {
    expect(() =>
      assertSubmittable(["https://enki-five.vercel.app/tools"]),
    ).toThrow(/enkitools\.com/);
  });

  it("rejects a non-https URL", () => {
    expect(() => assertSubmittable(["http://enkitools.com/"])).toThrow(/https/);
  });

  it("rejects an empty list", () => {
    expect(() => assertSubmittable([])).toThrow(/no urls/i);
  });
});

describe("buildSubmission", () => {
  it("produces the documented payload shape", () => {
    expect(buildSubmission(["https://enkitools.com/tools"])).toEqual({
      host: "enkitools.com",
      key: INDEXNOW_KEY,
      keyLocation: keyLocation(),
      urlList: ["https://enkitools.com/tools"],
    });
  });
});

// scripts/indexnow.mjs is plain Node ESM and cannot import this TypeScript
// module, so it repeats the key and origin as literals. Rotate the key in one
// place and forget the other and every submission 403s, because the key sent
// would no longer match the published file. This pins them together.
describe("script/library drift", () => {
  it("scripts/indexnow.mjs uses the same key and origin", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts", "indexnow.mjs"),
      "utf8",
    );
    expect(script).toContain(`const KEY = "${INDEXNOW_KEY}"`);
    expect(script).toContain(`const HOST = "${INDEXNOW_HOST}"`);
  });

  it("public/ serves a key file matching the key", () => {
    const file = readFileSync(
      join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`),
      "utf8",
    );
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });
});
