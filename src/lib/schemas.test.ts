import { describe, it, expect } from "vitest";
import { newsletterSchema, submissionFormSchema } from "@/lib/schemas";

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
