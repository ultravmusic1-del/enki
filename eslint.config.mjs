import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // design-sync (see .design-sync/NOTES.md). Neither of these is project
    // source: `.ds-sync/` is the converter staged from the skill, and
    // `ds-bundle/` is generated output that inlines React itself — linting it
    // reports rules-of-hooks violations against React's own compiled source.
    // `.design-sync/previews/` is deliberately NOT ignored; those are
    // hand-written and worth linting.
    ".ds-sync/**",
    "ds-bundle/**",
  ]),
]);

export default eslintConfig;
