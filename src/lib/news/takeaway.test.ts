import { describe, it, expect } from "vitest";
import { founderTakeaway } from "@/lib/news/takeaway";

describe("founderTakeaway", () => {
  it("is the first founder bullet's lead and first sentence", () => {
    const body = "Lede.\n\n## What it means for founders\n\n- **Costs fall.** Budget less. More.\n- Second.";
    expect(founderTakeaway(body)).toBe("Costs fall. Budget less.");
  });
  it("is null without a founder bullet, so cards never repeat the summary", () => {
    expect(founderTakeaway("Just a lede.")).toBeNull();
    expect(founderTakeaway(null)).toBeNull();
    expect(founderTakeaway("## What it means for founders\n\nA paragraph, no list.")).toBeNull();
  });
  it("uses the bold lead alone when nothing follows it", () => {
    expect(founderTakeaway("## What it means for founders\n\n- **Watch the rules.**")).toBe("Watch the rules.");
  });
});
