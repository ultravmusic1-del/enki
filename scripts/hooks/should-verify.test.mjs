import { describe, it, expect } from "vitest";
import { shouldVerify } from "./should-verify.mjs";

describe("shouldVerify", () => {
  it("runs the gate for TypeScript changes", () => {
    expect(shouldVerify(["src/lib/content.ts"])).toBe(true);
  });

  it("runs the gate for component changes", () => {
    expect(shouldVerify(["src/components/shared/tool-card.tsx"])).toBe(true);
  });

  it("runs the gate for stylesheet changes", () => {
    expect(shouldVerify(["src/app/globals.css"])).toBe(true);
  });

  it("runs the gate when dependencies change", () => {
    expect(shouldVerify(["package.json"])).toBe(true);
  });

  it("runs the gate for the scripts that back it", () => {
    expect(shouldVerify(["scripts/doctor.mjs"])).toBe(true);
  });

  it("skips the gate for a docs-only commit", () => {
    expect(shouldVerify(["handoff.md", "docs/superpowers/plans/x.md"])).toBe(
      false,
    );
  });

  it("skips the gate for image-only commits", () => {
    expect(shouldVerify(["public/screenshots/cursor/hero.png"])).toBe(false);
  });

  it("runs the gate when a commit mixes docs and code", () => {
    expect(shouldVerify(["handoff.md", "src/lib/seo.ts"])).toBe(true);
  });

  it("skips the gate for an empty stage", () => {
    expect(shouldVerify([])).toBe(false);
  });
});
