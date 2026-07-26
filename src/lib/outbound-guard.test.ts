import { describe, it, expect } from "vitest";
import { isHttpUrl } from "@/lib/safe-url";
import { resolveOutboundTarget } from "@/lib/outbound";

/**
 * The /go/[slug] route must never emit a non-http Location. This pins the
 * decision function the route relies on, for the tool shapes it actually sees.
 */
describe("outbound target guard", () => {
  it("passes a normal website through", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: undefined,
    });
    expect(isHttpUrl(target.url)).toBe(true);
  });

  it("prefers the affiliate URL when present", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: "https://ref.example/cursor",
    });
    expect(target.url).toBe("https://ref.example/cursor");
    expect(target.isAffiliate).toBe(true);
  });

  it("flags a javascript: affiliate URL as unsafe to emit", () => {
    const target = resolveOutboundTarget({
      website: "https://cursor.com",
      affiliateUrl: "javascript:alert(1)",
    });
    expect(isHttpUrl(target.url)).toBe(false);
  });
});
