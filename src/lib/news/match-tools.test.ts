import { describe, it, expect } from "vitest";
import { matchTools, type MatchableTool } from "@/lib/news/match-tools";

const tools: MatchableTool[] = [
  { slug: "cursor", name: "Cursor" },
  { slug: "runway", name: "Runway" },
  { slug: "pika", name: "Pika" },
  { slug: "elevenlabs", name: "ElevenLabs", aliases: ["Eleven Labs"] },
  { slug: "windsurf", name: "Windsurf", aliases: ["Codeium"] },
  { slug: "midjourney", name: "Midjourney" },
  { slug: "suno", name: "Suno" },
  { slug: "github-copilot", name: "GitHub Copilot" },
  { slug: "dall-e-3", name: "DALL·E 3", aliases: ["DALL-E"] },
];

describe("matchTools", () => {
  it("matches an unambiguous name in any case", () => {
    expect(matchTools("elevenlabs raises $180M", tools)).toEqual(["elevenlabs"]);
  });

  it("matches aliases", () => {
    expect(matchTools("Codeium rebrands its editor", tools)).toEqual(["windsurf"]);
    expect(matchTools("Eleven Labs opens a Tokyo office", tools)).toEqual(["elevenlabs"]);
  });

  it("matches whole words only", () => {
    expect(matchTools("A cursory glance at Pikachu", tools)).toEqual([]);
  });

  it("matches ambiguous names only in their exact casing", () => {
    expect(matchTools("The startup has 18 months of runway", tools)).toEqual([]);
    expect(matchTools("Runway launches Gen-5", tools)).toEqual(["runway"]);
    expect(matchTools("move the cursor to the end", tools)).toEqual([]);
  });

  it("matches through possessives and punctuation", () => {
    expect(matchTools("Midjourney's new model, explained", tools)).toEqual(["midjourney"]);
  });

  it("matches names containing punctuation", () => {
    expect(matchTools("DALL-E gets a successor", tools)).toEqual(["dall-e-3"]);
    expect(matchTools("Hands on with DALL·E 3", tools)).toEqual(["dall-e-3"]);
  });

  it("orders results by first appearance", () => {
    expect(matchTools("Suno sues, while Cursor ships", tools)).toEqual(["suno", "cursor"]);
  });

  it("returns each tool once", () => {
    expect(matchTools("Cursor, Cursor, Cursor", tools)).toEqual(["cursor"]);
  });

  it("caps the result at five", () => {
    const text = "Cursor Runway Pika ElevenLabs Windsurf Midjourney Suno";
    expect(matchTools(text, tools)).toHaveLength(5);
  });

  it("does not match a partial multi-word name", () => {
    expect(matchTools("GitHub ships Actions v5", tools)).toEqual([]);
  });
});
