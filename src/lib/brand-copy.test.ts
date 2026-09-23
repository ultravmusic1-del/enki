import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { siteConfig } from "@/lib/site";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** Files whose visible copy the news repositioning (merge 4) rewrote. */
const COPY_FILES = [
  "src/components/layout/site-footer.tsx",
  "src/components/shared/affiliate-disclosure.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/tools/[slug]/opengraph-image.tsx",
];

describe("site-wide brand copy", () => {
  it("describes Enki as news first", () => {
    expect(siteConfig.description.toLowerCase()).toContain("news");
    expect(siteConfig.description.toLowerCase()).not.toContain("oracle for ai tools");
  });

  it("keeps the directory tagline off the homepage share image", () => {
    // Case-insensitive: the image source writes its eyebrow in capitals.
    const source = readFileSync("src/app/opengraph-image.tsx", "utf8").toLowerCase();
    expect(source).not.toContain("oracle for ai tools");
  });

  it("never prints the old enki.tools domain on a share image or page", () => {
    for (const path of COPY_FILES) {
      expect(readFileSync(path, "utf8"), path).not.toContain("enki.tools");
    }
  });

  it("prints the canonical host on share images, never a preview deployment's", () => {
    // siteConfig.url resolves to the preview origin on preview builds, so a
    // share image built from it would advertise a *.vercel.app address.
    for (const path of ["src/app/opengraph-image.tsx", "src/app/tools/[slug]/opengraph-image.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("new URL(CANONICAL_SITE_URL).host");
      // Forbid building a host from it, not merely mentioning it in a comment.
      expect(source, path).not.toMatch(/new URL\(\s*siteConfig\.url\s*\)/);
    }
  });

  it("describes full stories for founders, not summaries", () => {
    const footer = readFileSync("src/components/layout/site-footer.tsx", "utf8");
    for (const text of [siteConfig.description, footer]) {
      expect(text.toLowerCase()).not.toContain("clear summaries");
    }
    expect(siteConfig.description.toLowerCase()).toContain("founders");
  });

  it("has no em or en dash in the rewritten copy", () => {
    for (const text of [
      siteConfig.description,
      readFileSync("src/components/shared/affiliate-disclosure.tsx", "utf8"),
      readFileSync("src/components/layout/site-footer.tsx", "utf8"),
    ]) {
      expect(text.includes(EM_DASH) || text.includes(EN_DASH)).toBe(false);
    }
  });

  it("keeps Enki Daily copy free of dashes and reader counts", () => {
    const files = [
      "src/components/home/home-hero.tsx",
      "src/components/home/todays-issue.tsx",
      "src/components/home/how-its-made.tsx",
      "src/components/home/takeaway-anatomy.tsx",
      "src/components/home/subscribe-band.tsx",
      "src/components/home/trending-tools.tsx",
      "src/components/home/home-faq.tsx",
      "src/components/home/sticky-subscribe-bar.tsx",
      "src/app/welcome/page.tsx",
      "src/app/unsubscribe/page.tsx",
      "src/components/layout/site-footer.tsx",
    ];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain(EM_DASH);
      expect(text, path).not.toContain(EN_DASH);
      expect(text, path).not.toMatch(/\b\d[\d,.]*\+?\s*(readers|subscribers)\b/i);
    }
  });

  it("names the newsletter Enki Daily, not The Tablet", () => {
    const footer = readFileSync("src/components/layout/site-footer.tsx", "utf8");
    expect(footer).toContain("Enki Daily");
    expect(footer).not.toContain("The Tablet");
  });
});
