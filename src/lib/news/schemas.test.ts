import { describe, it, expect } from "vitest";
import {
  BODY_MAX_WORDS,
  BODY_MIN_WORDS,
  FOUNDER_HEADING,
  bodyProblems,
  countWords,
  newsSourceInputSchema,
  normalizeBody,
  storyPublishSchema,
} from "@/lib/news/schemas";

// Built from char codes: the editing tools decode escape sequences into the real characters.
const BOM = String.fromCharCode(0xfeff);
const NEL = String.fromCharCode(0x85);
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

const base = {
  id: "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b",
  headline: "OpenAI ships GPT-6",
  summary: "x".repeat(40),
  beat: "models-labs",
  featured: false,
  toolSlugs: ["cursor"],
};

describe("storyPublishSchema", () => {
  it("accepts a complete story", () => {
    expect(storyPublishSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    [39, false],
    [40, true],
    [320, true],
    [321, false],
  ])("summary of %i chars → valid %s", (n, ok) => {
    expect(storyPublishSchema.safeParse({ ...base, summary: "x".repeat(n) }).success).toBe(ok);
  });

  it("counts the summary after trimming", () => {
    expect(
      storyPublishSchema.safeParse({ ...base, summary: `  ${"x".repeat(39)}  ` }).success,
    ).toBe(false);
  });

  it("rejects an unknown beat", () => {
    expect(storyPublishSchema.safeParse({ ...base, beat: "sports" }).success).toBe(false);
  });

  it("caps tools at five and rejects duplicates", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(storyPublishSchema.safeParse({ ...base, toolSlugs: six }).success).toBe(false);
    expect(
      storyPublishSchema.safeParse({ ...base, toolSlugs: ["cursor", "cursor"] }).success,
    ).toBe(false);
  });

  it("rejects an id that is not a uuid", () => {
    expect(storyPublishSchema.safeParse({ ...base, id: "42" }).success).toBe(false);
  });
});

const DASHES = String.fromCharCode(0x2013, 0x2014);

function body(words: number, extra = ""): string {
  // "## What it means for founders" is 6 words ("##" counts); the rest are filler.
  return `${"word ".repeat(words - 6)}\n\n## ${FOUNDER_HEADING}\n${extra}`;
}

describe("countWords", () => {
  it("splits on any whitespace and ignores padding", () => {
    expect(countWords("  one\ttwo\n\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
  });

  it("counts words separated by U+0085 the same as with spaces", () => {
    expect(countWords(`one${NEL}two${NEL}three`)).toBe(3);
  });

  it("does not let a U+FEFF create a word", () => {
    expect(countWords(`one ${BOM} two`)).toBe(2);
  });
});

describe("normalizeBody", () => {
  it("removes U+FEFF", () => {
    expect(normalizeBody(`a${BOM}b`)).toBe("ab");
  });

  it("converts CRLF and bare CR to LF", () => {
    expect(normalizeBody("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("converts U+0085, U+2028 and U+2029 to LF", () => {
    expect(normalizeBody(`a${NEL}b${LINE_SEP}c${PARA_SEP}d`)).toBe("a\nb\nc\nd");
  });
});

describe("bodyProblems", () => {
  it("accepts the word-count boundaries", () => {
    expect(bodyProblems(body(BODY_MIN_WORDS))).toEqual([]);
    expect(bodyProblems(body(BODY_MAX_WORDS))).toEqual([]);
  });

  it("rejects one word either side of the boundaries", () => {
    expect(bodyProblems(body(BODY_MIN_WORDS - 1))).toHaveLength(1);
    expect(bodyProblems(body(BODY_MAX_WORDS + 1))).toHaveLength(1);
  });

  it("rejects either dash", () => {
    for (const dash of DASHES) {
      expect(bodyProblems(body(BODY_MIN_WORDS) + ` a${dash}b`).join(" ")).toMatch(/dash/i);
    }
  });

  it("requires the founder heading on its own line", () => {
    const noHeading = "word ".repeat(BODY_MIN_WORDS);
    expect(bodyProblems(noHeading).join(" ")).toMatch(/founders/);
    const inline = `${"word ".repeat(BODY_MIN_WORDS)} ## ${FOUNDER_HEADING}`;
    expect(bodyProblems(inline).join(" ")).toMatch(/founders/);
  });

  it("accepts the founder heading on a line ending in a bare CR", () => {
    const bareCr = `${"word ".repeat(BODY_MIN_WORDS - 6)}\r\r## ${FOUNDER_HEADING}\r`;
    expect(bodyProblems(bareCr)).toEqual([]);
  });
});

describe("storyPublishSchema body", () => {
  const base = {
    id: "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b",
    headline: "H",
    summary: "A summary that is comfortably over forty characters long.",
    beat: "research",
    featured: false,
    toolSlugs: [],
  };

  it("treats a blank body as absent", () => {
    const parsed = storyPublishSchema.parse({ ...base, body: "   " });
    expect(parsed.body).toBeUndefined();
  });

  it("refuses a body that breaks the rules", () => {
    expect(storyPublishSchema.safeParse({ ...base, body: "too short" }).success).toBe(false);
  });

  it("accepts a valid body, trimmed", () => {
    const parsed = storyPublishSchema.parse({ ...base, body: `  ${body(BODY_MIN_WORDS)}  ` });
    expect(parsed.body?.startsWith("word")).toBe(true);
  });

  it("publishes a body with bare CR line breaks only after normalising to LF", () => {
    const bareCrBody = body(BODY_MIN_WORDS).split("\n").join("\r");
    const parsed = storyPublishSchema.parse({ ...base, body: bareCrBody });
    expect(parsed.body).not.toContain("\r");
    expect(parsed.body).toContain("\n");
  });
});

describe("newsSourceInputSchema", () => {
  const source = {
    name: "TechCrunch AI",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    siteUrl: "https://techcrunch.com",
  };

  it("accepts http(s) URLs", () => {
    expect(newsSourceInputSchema.safeParse(source).success).toBe(true);
  });

  it("rejects non-http feed URLs", () => {
    expect(
      newsSourceInputSchema.safeParse({ ...source, feedUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(newsSourceInputSchema.safeParse({ ...source, name: " " }).success).toBe(false);
  });
});
