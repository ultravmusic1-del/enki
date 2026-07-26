import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Anonymous write paths must use .insert(), never .upsert().
 *
 * supabase-js .insert() defaults to return=minimal, so it needs no SELECT and
 * works under an anon-insert-only policy. .upsert() asks for a representation,
 * which needs SELECT, and fails silently where anon has no read policy. This
 * broke the newsletter signup once already (handoff.md §10, gotcha 1).
 */
const ANON_WRITE_PATHS = [
  "src/app/actions/newsletter.ts",
  "src/app/submit/actions.ts",
  "src/app/go/[slug]/route.ts",
];

describe("anonymous write paths", () => {
  it.each(ANON_WRITE_PATHS)(
    "%s writes with .insert(), not .upsert()",
    (path) => {
      expect(readFileSync(path, "utf8")).not.toContain(".upsert(");
    },
  );

  it.each(ANON_WRITE_PATHS)("%s still exists at the audited path", (path) => {
    expect(() => readFileSync(path, "utf8")).not.toThrow();
  });
});
