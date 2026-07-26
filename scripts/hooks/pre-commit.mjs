#!/usr/bin/env node
/**
 * Pre-commit gate. Invoked through .githooks/pre-commit, which git finds via
 * core.hooksPath — so unlike anything in .git/hooks, this travels between
 * machines through a normal pull.
 *
 * Bypass with `git commit --no-verify` when you genuinely need to; CI still
 * runs the same gate on push.
 */
import { execFileSync, execSync } from "node:child_process";
import { shouldVerify } from "./should-verify.mjs";

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0);

if (!shouldVerify(staged)) {
  console.log("pre-commit: no code staged, skipping the gate");
  process.exit(0);
}

console.log("pre-commit: running pnpm verify");

try {
  // execSync takes one string through a shell, so it finds pnpm's .cmd shim on
  // Windows without execFileSync's PATHEXT resolution problem.
  execSync("pnpm verify", { stdio: "inherit" });
} catch {
  console.error(
    "\npre-commit: `pnpm verify` failed. Fix it, or commit with --no-verify if you know what you are doing.",
  );
  process.exit(1);
}
