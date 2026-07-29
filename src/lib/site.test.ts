import { describe, it, expect, vi, afterEach } from "vitest";
import { CANONICAL_SITE_URL, resolveSiteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL, without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.enkitools.com/");
    expect(resolveSiteUrl()).toBe("https://staging.enkitools.com");
  });

  it("gives a preview deployment its own origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "enki-git-branch.vercel.app");
    expect(resolveSiteUrl()).toBe("https://enki-git-branch.vercel.app");
  });

  it("falls back to localhost outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
  });

  // The regression this file exists for. Before this change a production build
  // with no NEXT_PUBLIC_SITE_URL resolved to enki-five.vercel.app, which made
  // every canonical, sitemap entry and JSON-LD id disown the real domain.
  it("never resolves a vercel.app origin in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv(
      "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
      "enki-five.vercel.app",
    );
    expect(resolveSiteUrl()).toBe(CANONICAL_SITE_URL);
    expect(resolveSiteUrl()).not.toMatch(/vercel\.app$/);
  });

  it("pins the canonical domain", () => {
    expect(CANONICAL_SITE_URL).toBe("https://enkitools.com");
  });
});
