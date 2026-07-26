import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("keeps an ordinary internal path", () => {
    expect(safeInternalPath("/admin")).toBe("/admin");
  });

  it("keeps a path with a query string and fragment", () => {
    expect(safeInternalPath("/tools?sort=rating#top")).toBe(
      "/tools?sort=rating#top",
    );
  });

  it("falls back when the parameter is absent", () => {
    expect(safeInternalPath(null)).toBe("/");
  });

  it("falls back on an empty string", () => {
    expect(safeInternalPath("")).toBe("/");
  });

  it("rejects an absolute http URL", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    // "//evil.example" inherits the current scheme and leaves the origin.
    expect(safeInternalPath("//evil.example")).toBe("/");
  });

  it("rejects the backslash variant of a protocol-relative URL", () => {
    // Several browsers normalize "\" to "/", making "/\evil" behave as "//evil".
    expect(safeInternalPath("/\\evil.example")).toBe("/");
  });

  it("rejects a javascript: target", () => {
    expect(safeInternalPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects a scheme-relative URL with mixed slashes", () => {
    expect(safeInternalPath("/\\/evil.example")).toBe("/");
  });

  it("honours an explicit fallback", () => {
    expect(safeInternalPath("https://evil.example", "/login")).toBe("/login");
  });
});
