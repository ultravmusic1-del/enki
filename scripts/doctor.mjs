#!/usr/bin/env node
/**
 * `pnpm doctor` — converge this machine and report what is in flight.
 *
 * Enki is developed on two machines that sync through GitHub twice a day.
 * Everything gitignored (.env.local) or unversioned (.git/hooks, node_modules)
 * drifts silently between them. This command names the drift and, with --fix,
 * repairs what can be repaired without guessing at secrets.
 *
 * Usage:
 *   pnpm doctor           report only
 *   pnpm doctor --fix     repair hooks, dependencies, and a missing .env.local
 *   pnpm doctor --json    machine-readable output
 *
 * Exit code is 1 when any check FAILs, so a caller can branch on it. A sleeping
 * Supabase is a WARN, not a FAIL: the public site runs fine on the seed.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { checkEnv } from "./doctor/checks/env.mjs";
import { isDepsStale } from "./doctor/checks/deps.mjs";
import { isHooksPathConfigured, HOOKS_PATH } from "./doctor/checks/hooks.mjs";
import {
  expectedNodeMajor,
  expectedPnpmVersion,
  majorOf,
  parseUserAgentPnpm,
} from "./doctor/checks/toolchain.mjs";
import { probeSupabase } from "./doctor/checks/supabase.mjs";
import { parseAheadBehind, countDirtyFiles } from "./doctor/checks/git.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const JSON_OUT = args.includes("--json");

const read = (relative) => {
  const path = join(ROOT, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

const mtimeMs = (relative) => {
  const path = join(ROOT, relative);
  return existsSync(path) ? statSync(path).mtimeMs : null;
};

/** Run a command and return trimmed stdout, or "" if it fails. */
const run = (command, commandArgs) => {
  try {
    return execFileSync(command, commandArgs, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const checks = [];
const record = (name, status, detail) => checks.push({ name, status, detail });

// --- toolchain -------------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
const nodeMajor = expectedNodeMajor(pkg);
const pnpmVersion = expectedPnpmVersion(pkg);
const runningNodeMajor = majorOf(process.version);
const runningPnpm = parseUserAgentPnpm(process.env.npm_config_user_agent);

if (nodeMajor !== null && runningNodeMajor !== nodeMajor) {
  record(
    "toolchain",
    "fail",
    `node ${process.version} but package.json expects major ${nodeMajor}`,
  );
} else if (pnpmVersion && runningPnpm && runningPnpm !== pnpmVersion) {
  record(
    "toolchain",
    "warn",
    `pnpm ${runningPnpm} but package.json pins ${pnpmVersion}`,
  );
} else {
  record(
    "toolchain",
    "pass",
    `node ${process.version}, pnpm ${runningPnpm ?? "(not run via pnpm)"}`,
  );
}

// --- dependencies ----------------------------------------------------------
const depsStale = isDepsStale({
  lockMtimeMs: mtimeMs("pnpm-lock.yaml") ?? 0,
  modulesMtimeMs: mtimeMs("node_modules/.modules.yaml"),
});

if (depsStale && FIX) {
  console.log("fixing: pnpm install");
  try {
    // execSync takes one string through a shell, so it finds pnpm's .cmd shim
    // on Windows without the argument-splitting hazard of execFileSync+shell.
    execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
    record("deps", "pass", "installed");
  } catch {
    record("deps", "fail", "pnpm install failed");
  }
} else {
  record(
    "deps",
    depsStale ? "fail" : "pass",
    depsStale
      ? "node_modules is older than pnpm-lock.yaml — run `pnpm install`"
      : "in sync with pnpm-lock.yaml",
  );
}

// --- environment -----------------------------------------------------------
const exampleBody = read(".env.example") ?? "";
let localBody = read(".env.local");

if (localBody === null && FIX) {
  console.log("fixing: creating .env.local from .env.example");
  copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env.local"));
  localBody = read(".env.local");
}

const env = checkEnv({ exampleBody, localBody });
record(
  "env",
  env.status,
  env.status === "pass"
    ? ".env.local has every required key"
    : env.reason === "no-file"
      ? `.env.local is missing — needs ${env.missing.join(", ")}`
      : `.env.local is missing ${env.missing.join(", ")}`,
);

// --- git hooks -------------------------------------------------------------
let hooksPath = run("git", ["config", "core.hooksPath"]);

if (!isHooksPathConfigured(hooksPath) && FIX) {
  console.log(`fixing: git config core.hooksPath ${HOOKS_PATH}`);
  run("git", ["config", "core.hooksPath", HOOKS_PATH]);
  hooksPath = run("git", ["config", "core.hooksPath"]);
}

record(
  "hooks",
  isHooksPathConfigured(hooksPath) ? "pass" : "fail",
  isHooksPathConfigured(hooksPath)
    ? `core.hooksPath = ${HOOKS_PATH}`
    : "core.hooksPath is unset — run `pnpm doctor --fix`",
);

// --- supabase --------------------------------------------------------------
const envPairs = Object.fromEntries(
  (localBody ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
);

const probe = await probeSupabase({
  url: envPairs.NEXT_PUBLIC_SUPABASE_URL ?? null,
  key: envPairs.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
});

record("supabase", probe.status === "awake" ? "pass" : "warn", {
  awake: "project is awake",
  asleep:
    "project is paused or unreachable — resume it before touching auth, reviews, or admin",
  unreachable: `REST root returned ${probe.code}`,
  skip: "no credentials in .env.local — skipped",
}[probe.status]);

// --- in-flight state -------------------------------------------------------
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const upstream = run("git", [
  "rev-parse",
  "--abbrev-ref",
  "--symbolic-full-name",
  "@{u}",
]);
const { ahead, behind } = parseAheadBehind(
  upstream
    ? run("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`])
    : "",
);
const dirty = countDirtyFiles(run("git", ["status", "--porcelain"]));
const lastCommit = run("git", ["log", "-1", "--format=%h %s"]);

const inFlight = { branch, upstream, ahead, behind, dirty, lastCommit };

// --- report ----------------------------------------------------------------
const failed = checks.filter((c) => c.status === "fail");

if (JSON_OUT) {
  console.log(
    JSON.stringify({ checks, inFlight, ok: failed.length === 0 }, null, 2),
  );
} else {
  const label = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  console.log("\nEnki doctor\n");
  for (const check of checks) {
    console.log(
      `  ${label[check.status]}  ${check.name.padEnd(10)} ${check.detail}`,
    );
  }

  console.log("\nIn flight");
  console.log(
    `  branch ${branch || "?"} · ${ahead} ahead / ${behind} behind ${upstream || "(no upstream)"} · ${dirty} uncommitted file(s)`,
  );
  console.log(`  last: ${lastCommit || "(no commits)"}`);

  console.log(
    failed.length === 0
      ? "\nAll checks passed.\n"
      : `\n${failed.length} check(s) failed.${FIX ? "" : " Run `pnpm doctor --fix` to repair what can be repaired."}\n`,
  );
}

process.exit(failed.length === 0 ? 0 : 1);
