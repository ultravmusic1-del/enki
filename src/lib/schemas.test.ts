import { describe, it, expect } from "vitest";
import {
  newsletterSchema,
  reviewFormSchema,
  submissionFormSchema,
} from "@/lib/schemas";

describe("schemas: newsletter", () => {
  it("accepts a valid email with the honeypot left empty", () => {
    expect(newsletterSchema.safeParse({ email: "a@example.com", hp: "" }).success).toBe(
      true,
    );
  });

  it("accepts a valid email with no honeypot key at all", () => {
    expect(newsletterSchema.safeParse({ email: "a@example.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(newsletterSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("caps the email length so a bot cannot post a megabyte", () => {
    const long = `${"a".repeat(300)}@example.com`;
    expect(newsletterSchema.safeParse({ email: long }).success).toBe(false);
  });
});

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
