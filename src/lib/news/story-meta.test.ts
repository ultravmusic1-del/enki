import { describe, it, expect } from "vitest";
import { pageCount, pageRange, parsePageParam, storyRobots } from "@/lib/news/story-meta";

describe("storyRobots", () => {
  it("keeps a story without a take out of the index", () => {
    expect(storyRobots(null)).toEqual({ index: false, follow: true });
  });
  it("indexes a story whose take is 300+ characters", () => {
    expect(storyRobots("t".repeat(300))).toEqual({ index: true, follow: true });
    expect(storyRobots("t".repeat(299))).toEqual({ index: false, follow: true });
  });
});

describe("parsePageParam", () => {
  it.each([
    ["2", 2],
    ["10", 10],
    ["99999", 99999],
  ])("accepts %s", (raw, expected) => {
    expect(parsePageParam(raw)).toBe(expected);
  });

  it.each(["1", "0", "-2", "abc", "007", "2.5", " 2", "100000", ""])(
    "rejects %j (page 1 lives at /news)",
    (raw) => {
      expect(parsePageParam(raw)).toBeNull();
    },
  );
});

describe("pagination math", () => {
  it("never reports fewer than one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(30)).toBe(1);
    expect(pageCount(31)).toBe(2);
  });
  it("maps a page to an inclusive row range", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 29 });
    expect(pageRange(2)).toEqual({ from: 30, to: 59 });
  });
});
