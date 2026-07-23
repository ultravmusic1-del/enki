import { describe, it, expect } from "vitest";
import { summarizeReviews } from "@/lib/reviews";

describe("reviews: summarizeReviews", () => {
  it("returns a zeroed summary for no reviews", () => {
    expect(summarizeReviews([])).toEqual({ average: 0, count: 0 });
  });

  it("averages ratings and rounds to one decimal", () => {
    // (5 + 4 + 4) / 3 = 4.333… → 4.3
    expect(summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({
      average: 4.3,
      count: 3,
    });
  });

  it("handles a single review exactly", () => {
    expect(summarizeReviews([{ rating: 5 }])).toEqual({ average: 5, count: 1 });
  });

  it("rounds half up at the first decimal", () => {
    // (4 + 5) / 2 = 4.5
    expect(summarizeReviews([{ rating: 4 }, { rating: 5 }])).toEqual({
      average: 4.5,
      count: 2,
    });
  });

  it("does not mutate the input", () => {
    const input = [{ rating: 3 }, { rating: 5 }];
    const snapshot = JSON.stringify(input);
    summarizeReviews(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
