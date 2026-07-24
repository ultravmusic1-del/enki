import { describe, it, expect } from "vitest";
import { getActiveDeals, isDealActive } from "@/lib/deals";
import type { Deal, Tool } from "@/lib/schemas";

const NOW = new Date("2026-07-23T12:00:00Z");

describe("deals: isDealActive", () => {
  it("is false when there is no deal", () => {
    expect(isDealActive(undefined, NOW)).toBe(false);
  });

  it("is true for an ongoing deal (no expiry)", () => {
    expect(isDealActive({ headline: "x" }, NOW)).toBe(true);
  });

  it("is true on the expiry day and false the day after", () => {
    expect(isDealActive({ headline: "x", expiresAt: "2026-07-23" }, NOW)).toBe(true);
    expect(isDealActive({ headline: "x", expiresAt: "2026-07-22" }, NOW)).toBe(false);
  });
});

describe("deals: getActiveDeals", () => {
  const make = (slug: string, editorScore: number, deal?: Deal): Tool =>
    ({ slug, name: slug, editorScore, rating: 4, deal } as unknown as Tool);

  it("returns only tools with a live deal, best editor score first", () => {
    const tools = [
      make("a", 7, { headline: "A deal" }),
      make("b", 9, { headline: "B deal" }),
      make("c", 8), // no deal
      make("d", 10, { headline: "expired", expiresAt: "2026-01-01" }),
    ];
    const active = getActiveDeals(tools, NOW);
    expect(active.map((t) => t.slug)).toEqual(["b", "a"]);
    expect(active.every((t) => t.deal)).toBe(true);
  });

  it("returns an empty array when nothing has a live deal", () => {
    expect(getActiveDeals([make("a", 5)], NOW)).toEqual([]);
  });
});
