import { describe, it, expect } from "vitest";
import {
  expectedNodeMajor,
  expectedPnpmVersion,
  majorOf,
  parseUserAgentPnpm,
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

describe("parseUserAgentPnpm", () => {
  it("reads the version out of the user agent pnpm sets", () => {
    expect(
      parseUserAgentPnpm("pnpm/11.12.0 npm/? node/v24.14.1 win32 x64"),
    ).toBe("11.12.0");
  });

  it("is null when the script was not run through pnpm", () => {
    expect(parseUserAgentPnpm("npm/10.9.0 node/v24.14.1 darwin arm64")).toBe(
      null,
    );
  });

  it("is null when the variable is unset", () => {
    expect(parseUserAgentPnpm(undefined)).toBe(null);
  });
});
