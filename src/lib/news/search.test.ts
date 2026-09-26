import { describe, it, expect } from "vitest";
import { normalizeQuery, searchTerms, SEARCH_MAX_TERMS, SEARCH_QUERY_MAX } from "@/lib/news/search";

describe("normalizeQuery", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(normalizeQuery("  OpenAI   agents ")).toBe("OpenAI agents");
    expect(normalizeQuery("x".repeat(200))).toHaveLength(SEARCH_QUERY_MAX);
  });
  it("takes the first value of a repeated parameter and handles absence", () => {
    expect(normalizeQuery(["meta", "muse"])).toBe("meta");
    expect(normalizeQuery(undefined)).toBe("");
  });
});

describe("searchTerms", () => {
  it("splits into lowercase terms and drops duplicates and one-letter terms", () => {
    expect(searchTerms("Meta Muse a meta")).toEqual(["meta", "muse"]);
  });
  it("keeps symbols that appear in AI news", () => {
    expect(searchTerms("$100 C++ AT&T gpt-5 Altman's")).toEqual(["$100", "c++", "at&t", "gpt-5", "altman's"]);
  });
  it("strips PostgREST filter syntax and LIKE wildcards", () => {
    const terms = searchTerms('open),headline.eq.x "quoted" 50% a_b *star*');
    for (const t of terms) expect(t).toMatch(/^[\p{L}\p{N}'$+&-]+$/u);
    expect(terms).toContain("50");
    expect(terms).toContain("ab");
  });
  it("caps the number of terms", () => {
    expect(searchTerms("one two three four five six seven")).toHaveLength(SEARCH_MAX_TERMS);
  });
  it("returns nothing searchable for punctuation alone", () => {
    expect(searchTerms("(),.*%")).toEqual([]);
  });
});
