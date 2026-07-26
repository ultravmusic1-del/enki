import { describe, it, expect } from "vitest";
import { isHttpUrl, safeExternalHref } from "@/lib/safe-url";
import { toolSchema, submissionFormSchema } from "@/lib/schemas";
import { tools as seedTools } from "@/data/tools";

describe("isHttpUrl", () => {
  it("accepts https", () => {
    expect(isHttpUrl("https://cursor.com")).toBe(true);
  });

  it("accepts http", () => {
    expect(isHttpUrl("http://example.com/path?q=1")).toBe(true);
  });

  // Each of these is ACCEPTED by z.url(), which is exactly why this exists.
  it("rejects javascript:", () => {
    expect(isHttpUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects javascript: regardless of case", () => {
    expect(isHttpUrl("JaVaScRiPt:alert(1)")).toBe(false);
  });

  it("rejects data:", () => {
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects vbscript:", () => {
    expect(isHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects file:", () => {
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a string that is not a URL at all", () => {
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isHttpUrl("")).toBe(false);
  });

  it("rejects leading whitespace used to smuggle a scheme", () => {
    expect(isHttpUrl("  javascript:alert(1)")).toBe(false);
  });
});

describe("safeExternalHref", () => {
  it("passes an http(s) URL through unchanged", () => {
    expect(safeExternalHref("https://cursor.com")).toBe("https://cursor.com");
  });

  it("neutralizes a javascript: URL to an inert href", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBe("#");
  });

  it("neutralizes null", () => {
    expect(safeExternalHref(null)).toBe("#");
  });

  it("honours a custom fallback", () => {
    expect(safeExternalHref("javascript:alert(1)", "/tools")).toBe("/tools");
  });
});

describe("schemas reject dangerous URL schemes", () => {
  it("submissionFormSchema rejects a javascript: url", () => {
    const result = submissionFormSchema.safeParse({
      name: "Evil",
      url: "javascript:alert(document.cookie)",
    });
    expect(result.success).toBe(false);
  });

  it("submissionFormSchema still accepts a normal url", () => {
    const result = submissionFormSchema.safeParse({
      name: "Cursor",
      url: "https://cursor.com",
    });
    expect(result.success).toBe(true);
  });

  it("toolSchema rejects a javascript: website", () => {
    const result = toolSchema.safeParse({
      ...seedTools[0],
      website: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("toolSchema rejects a javascript: affiliateUrl", () => {
    const result = toolSchema.safeParse({
      ...seedTools[0],
      affiliateUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("every seeded tool still validates", () => {
    // The allowlist must not have invalidated real content.
    for (const tool of seedTools) {
      expect(toolSchema.safeParse(tool).success).toBe(true);
    }
  });
});
