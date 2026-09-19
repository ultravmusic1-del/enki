import { describe, it, expect } from "vitest";
import { formatAge } from "@/lib/news/format-age";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("formatAge", () => {
  it.each([
    ["2026-09-19T11:59:40Z", "just now"],
    ["2026-09-19T11:48:00Z", "12m ago"],
    ["2026-09-19T09:00:00Z", "3h ago"],
    ["2026-09-16T12:00:00Z", "3d ago"],
  ])("%s → %s", (iso, expected) => {
    expect(formatAge(iso, NOW)).toBe(expected);
  });

  it("treats a future time as just now", () => {
    expect(formatAge("2026-09-19T13:00:00Z", NOW)).toBe("just now");
  });

  it("reports unknown for missing or invalid input", () => {
    expect(formatAge(null, NOW)).toBe("unknown");
    expect(formatAge("not a date", NOW)).toBe("unknown");
  });
});
