import { describe, it, expect } from "vitest";
import {
  expectedNodeMajor,
  expectedPnpmVersion,
  majorOf,
} from "./toolchain.mjs";

describe("majorOf", () => {
  it("reads the major from a plain version", () => {
    expect(majorOf("11.12.0")).toBe(11);
  });

  it("tolerates the v prefix that node -v prints", () => {
    expect(majorOf("v24.14.1")).toBe(24);
  });
});

describe("expectedNodeMajor", () => {
  it("reads the first number out of an engines range", () => {
    expect(expectedNodeMajor({ engines: { node: ">=24" } })).toBe(24);
  });

  it("is null when engines is absent", () => {
    expect(expectedNodeMajor({})).toBe(null);
  });
});

describe("expectedPnpmVersion", () => {
  it("reads the pinned version from packageManager", () => {
    expect(expectedPnpmVersion({ packageManager: "pnpm@11.12.0" })).toBe(
      "11.12.0",
    );
  });

  it("is null for a different package manager", () => {
    expect(expectedPnpmVersion({ packageManager: "yarn@4.0.0" })).toBe(null);
  });

  it("is null when packageManager is absent", () => {
    expect(expectedPnpmVersion({})).toBe(null);
  });
});
