import { describe, it, expect } from "vitest";
import { beats, beatSlugs, getBeat } from "@/data/beats";

describe("beats", () => {
  it("matches the database check constraint on stories.beat", () => {
    // The migration in Task 8 hardcodes this list. Changing one without the
    // other makes publishing fail with a constraint violation.
    expect(beatSlugs).toEqual([
      "models-labs",
      "products-launches",
      "funding-business",
      "policy-safety",
      "research",
    ]);
  });

  it("names every beat", () => {
    for (const beat of beats) expect(beat.name.length).toBeGreaterThan(0);
  });

  it("looks a beat up by slug", () => {
    expect(getBeat("research")?.name).toBe("Research");
    expect(getBeat("sports")).toBeUndefined();
  });
});
