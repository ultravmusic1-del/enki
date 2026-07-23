import { describe, it, expect } from "vitest";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";
import type { Tool } from "@/lib/schemas";

const base = { slug: "acme", website: "https://acme.com" } as unknown as Tool;

describe("outbound", () => {
  it("builds the internal redirect href from a slug", () => {
    expect(outboundHref("cursor")).toBe("/go/cursor");
  });

  it("falls back to the website when there is no affiliate URL", () => {
    expect(resolveOutboundTarget(base)).toEqual({
      url: "https://acme.com",
      isAffiliate: false,
    });
  });

  it("prefers the affiliate URL when present and marks it affiliate", () => {
    const tool = { ...base, affiliateUrl: "https://ref.acme.com?ref=enki" } as Tool;
    expect(resolveOutboundTarget(tool)).toEqual({
      url: "https://ref.acme.com?ref=enki",
      isAffiliate: true,
    });
  });
});
