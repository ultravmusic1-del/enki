#!/usr/bin/env node
/**
 * Point git at the repo's versioned hooks directory.
 *
 * Runs from package.json's `prepare` script, so a plain `pnpm install` wires
 * the hooks up on any machine. This exists because .git/hooks is never pushed:
 * a hook installed by hand on one device silently does not exist on the other.
 */
import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
} catch {
  process.exit(0); // Not a git checkout (CI tarball, published package). Nothing to wire.
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "ignore",
  });
  console.log("git hooks -> .githooks");
} catch (error) {
  // Never fail an install over hook wiring; doctor reports it instead.
  console.warn(`could not set core.hooksPath: ${error.message}`);
}
