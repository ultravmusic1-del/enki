import { describe, it, expect } from "vitest";
import { isHooksPathConfigured } from "./hooks.mjs";

describe("isHooksPathConfigured", () => {
  it("accepts the repo hooks directory", () => {
    expect(isHooksPathConfigured(".githooks")).toBe(true);
  });

  it("tolerates trailing whitespace from git output", () => {
    expect(isHooksPathConfigured(".githooks\n")).toBe(true);
  });

  it("rejects an unset value", () => {
    expect(isHooksPathConfigured("")).toBe(false);
  });

  it("rejects a different hooks directory", () => {
    expect(isHooksPathConfigured(".husky")).toBe(false);
  });
});
