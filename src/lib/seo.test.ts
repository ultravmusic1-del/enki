import { describe, it, expect } from "vitest";
import { getAllTools } from "@/lib/content";
import { parseVersusSlug, versusPairs, versusSlug } from "@/lib/seo";

const tools = await getAllTools();

describe("seo: versus slugs", () => {
  it("builds a canonical (alphabetical) versus slug", () => {
    expect(versusSlug("cursor", "windsurf")).toBe("cursor-vs-windsurf");
    expect(versusSlug("windsurf", "cursor")).toBe("cursor-vs-windsurf");
  });

  it("round-trips through parseVersusSlug", () => {
    expect(parseVersusSlug("cursor-vs-windsurf")).toEqual(["cursor", "windsurf"]);
  });

  it("returns null for a malformed versus slug", () => {
    expect(parseVersusSlug("cursor")).toBeNull();
    expect(parseVersusSlug("a-vs-b-vs-c")).toBeNull();
  });

  it("no tool slug contains the -vs- delimiter (split is unambiguous)", () => {
    expect(tools.every((t) => !t.slug.includes("-vs-"))).toBe(true);
  });
});

describe("seo: versusPairs", () => {
  it("emits canonical, unique, same-category pairs", () => {
    const pairs = versusPairs(tools);
    expect(pairs.length).toBeGreaterThan(0);
    const slugs = pairs.map((p) => versusSlug(p[0].slug, p[1].slug));
    expect(new Set(slugs).size).toBe(slugs.length); // unique
    for (const [a, b] of pairs) {
      expect(a.categorySlug).toBe(b.categorySlug); // same category
      expect(a.slug < b.slug).toBe(true); // canonical order
    }
  });
});
