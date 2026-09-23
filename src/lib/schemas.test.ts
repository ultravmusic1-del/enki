import { describe, it, expect } from "vitest";
import {
  reviewFormSchema,
  submissionFormSchema,
  toolSchema,
} from "@/lib/schemas";
import { tools as seedTools } from "@/data/tools";

describe("schemas: submission", () => {
  const valid = { name: "Acme AI", url: "https://acme.example.com" };

  it("accepts a minimal valid submission", () => {
    expect(submissionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("keeps the honeypot optional and unvalidated for humans", () => {
    expect(submissionFormSchema.safeParse({ ...valid, hp: "" }).success).toBe(true);
  });

  it("rejects an over-long pitch", () => {
    expect(
      submissionFormSchema.safeParse({ ...valid, pitch: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects an over-long name", () => {
    expect(
      submissionFormSchema.safeParse({ ...valid, name: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("rejects a non-URL website", () => {
    expect(submissionFormSchema.safeParse({ ...valid, url: "acme" }).success).toBe(
      false,
    );
  });
});

/**
 * The review modal is signed-in only, so no E2E test can open it and click
 * Submit — an earlier one tried, and sat timing out on a button that is never
 * rendered for a logged-out visitor. The rules the modal shows are pinned here
 * instead, including the exact copy, because the messages are what a user reads.
 */
describe("schemas: review form", () => {
  const valid = { name: "Ada", rating: 4 };

  it("accepts a rating and a name with no title or body", () => {
    expect(reviewFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects the untouched rating with the copy the form displays", () => {
    // The star picker defaults to 0, so this is what every empty submit hits.
    const result = reviewFormSchema.safeParse({ ...valid, rating: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "Please choose a rating",
    );
  });

  it("rejects a name too short to credit anyone", () => {
    const result = reviewFormSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "Please enter your name",
    );
  });

  it("rejects a rating outside one to five stars", () => {
    expect(reviewFormSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...valid, rating: 3.5 }).success).toBe(
      false,
    );
  });

  it("caps the title and body so a single review cannot flood the page", () => {
    expect(
      reviewFormSchema.safeParse({ ...valid, title: "x".repeat(81) }).success,
    ).toBe(false);
    expect(
      reviewFormSchema.safeParse({ ...valid, body: "x".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("toolSchema aliases", () => {
  it("keeps aliases instead of stripping them", () => {
    const parsed = toolSchema.parse({ ...seedTools[0], aliases: ["Alt name"] });
    expect(parsed.aliases).toEqual(["Alt name"]);
  });

  it("rejects an empty alias", () => {
    expect(toolSchema.safeParse({ ...seedTools[0], aliases: [""] }).success).toBe(false);
  });

  it("leaves aliases optional", () => {
    const withoutAliases = seedTools.find((t) => t.aliases === undefined);
    expect(withoutAliases).toBeDefined();
    expect(toolSchema.safeParse(withoutAliases).success).toBe(true);
  });

  it("never gives two seed tools the same name or alias", () => {
    // A shared term would attach both tools to every story that mentions it.
    const seen = new Map<string, string>();
    for (const tool of seedTools) {
      for (const term of [tool.name, ...(tool.aliases ?? [])]) {
        const key = term.toLowerCase();
        expect(seen.get(key) ?? tool.slug, `"${term}"`).toBe(tool.slug);
        seen.set(key, tool.slug);
      }
    }
  });
});
