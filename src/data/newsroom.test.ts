import { describe, it, expect } from "vitest";
import { corrections, correctionsFor, lastUpdatedAt } from "@/data/newsroom";
import { countWords } from "@/lib/news/schemas";

const sample = [
  { slug: "a", at: "2026-09-25T09:00:00Z", note: "Second fix." },
  { slug: "b", at: "2026-09-24T09:00:00Z", note: "Other story." },
  { slug: "a", at: "2026-09-24T12:00:00Z", note: "First fix." },
];

describe("corrections", () => {
  it("returns a story's corrections oldest first", () => {
    expect(correctionsFor("a", sample).map((c) => c.note)).toEqual(["First fix.", "Second fix."]);
  });
  it("dates the update to the newest correction, or null", () => {
    expect(lastUpdatedAt("a", sample)).toBe("2026-09-25T09:00:00Z");
    expect(lastUpdatedAt("none", sample)).toBeNull();
  });
  it("keeps every real correction well formed", () => {
    for (const c of corrections) {
      expect(c.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Number.isNaN(new Date(c.at).getTime())).toBe(false);
      expect(countWords(c.note)).toBeGreaterThan(3);
      expect(c.note).not.toMatch(/[–—]/);
    }
  });
});
