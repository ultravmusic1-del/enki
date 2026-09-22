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

  it("never prints the old enki.tools domain on a share image or page", () => {
    for (const path of COPY_FILES) {
      expect(readFileSync(path, "utf8"), path).not.toContain("enki.tools");
    }
  });

  it("has no em or en dash in the rewritten copy", () => {
    for (const text of [
      siteConfig.description,
      readFileSync("src/components/shared/affiliate-disclosure.tsx", "utf8"),
    ]) {
      expect(text.includes(EM_DASH) || text.includes(EN_DASH)).toBe(false);
    }
  });
});
