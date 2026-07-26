# Dev Workflow Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Enki's recurring development rituals and hard-won gotchas executable rather than prose, so two machines converge from a single `git pull` and every session starts productive.

**Architecture:** Four pillars, each independently shippable. (1) A composite `pnpm verify` gate, enforced by a **versioned** `.githooks/pre-commit` that travels through git plus a GitHub Actions backstop. (2) `pnpm doctor` — a self-healing convergence check that reports env, deps, hooks, toolchain, Supabase, and git in-flight state. (3) Rituals as code: a Playwright-driven `pnpm sweep` replacing improvised measurement JS, three Enki-specific Claude skills, and one documented gotcha promoted into a real test. (4) Doc hygiene: `handoff.md` and `CLAUDE.md` corrected and pointed at the new commands.

Doctor checks are written as **pure functions** in `scripts/doctor/checks/*.mjs` with the CLI as a thin orchestrator, so the logic is unit-testable without touching the filesystem, the network, or git.

**Tech Stack:** Node 24 (ESM `.mjs`), pnpm 11, Vitest 4, Playwright 1.61, GitHub Actions. No new dependencies.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `scripts/doctor.mjs` | Doctor CLI: orchestrate checks, print report, `--json` / `--fix` |
| `scripts/doctor/checks/env.mjs` | Parse dotenv keys; diff `.env.example` against `.env.local` |
| `scripts/doctor/checks/deps.mjs` | Decide whether `node_modules` is stale vs the lockfile |
| `scripts/doctor/checks/toolchain.mjs` | Read expected node/pnpm versions from `package.json`; compare |
| `scripts/doctor/checks/hooks.mjs` | Decide whether `core.hooksPath` is wired |
| `scripts/doctor/checks/supabase.mjs` | Probe the Supabase REST root with a timeout (awake/asleep) |
| `scripts/doctor/checks/git.mjs` | Parse ahead/behind and dirty-file counts from raw git output |
| `scripts/install-hooks.mjs` | `prepare` script: point `core.hooksPath` at `.githooks` |
| `scripts/hooks/pre-commit.mjs` | Pre-commit body: read staged files, decide, run the gate |
| `scripts/hooks/should-verify.mjs` | Pure: do these staged paths warrant running the gate? |
| `scripts/visual-sweep/report.mjs` | Pure: dedupe and format sweep findings |
| `scripts/visual-sweep.mjs` | Sweep CLI: drive Playwright, measure overflow, report |
| `.githooks/pre-commit` | Versioned hook shim (sh) that execs the Node body |
| `.github/workflows/verify.yml` | CI backstop guarding the Vercel auto-deploy |
| `.claude/skills/enki-session-start/SKILL.md` | Tell Claude to run doctor first and how to act on failures |
| `.claude/skills/enki-visual-sweep/SKILL.md` | Tell Claude to run `pnpm sweep` instead of improvising JS |
| `.claude/skills/enki-supabase-change/SKILL.md` | The RLS / grant / insert-vs-upsert checklist |
| `src/lib/supabase/anon-writes.test.ts` | Regression guard: anon write paths never use `.upsert()` |

**Modified:**

| Path | Change |
|---|---|
| `package.json` | Add `packageManager`, `engines`, and the `verify`/`doctor`/`sweep`/`prepare` scripts |
| `vitest.config.ts` | Extend `include` to pick up `scripts/**/*.test.mjs` |
| `handoff.md` | Correct three stale claims; add the two-machine workflow section |
| `CLAUDE.md` | Point the Visual Sweep rule at `pnpm sweep`; document the new commands |

---

## Task 1: Toolchain pinning and the `verify` gate

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the toolchain fields and scripts**

In `package.json`, add `packageManager` and `engines` as siblings of `"private": true`, and add four scripts. The full `scripts` block becomes:

```json
  "packageManager": "pnpm@11.12.0",
  "engines": {
    "node": ">=24",
    "pnpm": ">=11"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "pnpm typecheck && pnpm lint && pnpm test",
    "doctor": "node scripts/doctor.mjs",
    "sweep": "node scripts/visual-sweep.mjs",
    "prepare": "node scripts/install-hooks.mjs"
  },
```

`packageManager` is the two-machine parity fix: pnpm reads it and uses the pinned version on whichever device you're on.

- [ ] **Step 2: Create the prepare script it references**

`prepare` runs on every `pnpm install`, so it must exist before the next install or installs will fail. Create `scripts/install-hooks.mjs`:

```js
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
```

- [ ] **Step 3: Verify the gate runs**

Run: `pnpm verify`

Expected: typecheck, then eslint, then `Tests 121 passed (121)`. Exit code 0.

- [ ] **Step 4: Verify hook wiring happened**

Run: `git config core.hooksPath`

Expected: `.githooks`

(If it prints nothing, run `node scripts/install-hooks.mjs` directly and re-check.)

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/install-hooks.mjs
git commit -m "build: add verify gate, pin toolchain, and wire versioned git hooks"
```

---

## Task 2: Teach Vitest about script tests

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Extend the include glob**

Replace the `include` line in `vitest.config.ts`:

```ts
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
```

The doctor's logic lives in `scripts/`, so its tests must be collected from there.

- [ ] **Step 2: Prove the glob is live with a temporary test**

Create `scripts/glob-check.test.mjs`:

```js
import { describe, it, expect } from "vitest";

describe("vitest script glob", () => {
  it("collects tests from scripts/", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm test`

Expected: `Test Files 15 passed (15)` and `Tests 122 passed (122)` — one more file and one more test than the 14/121 baseline.

- [ ] **Step 4: Delete the temporary test**

```bash
rm scripts/glob-check.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "test: collect vitest specs from scripts/"
```

---

## Task 3: Doctor check — environment variables

This is the check that would have caught today's missing `.env.local`.

**Files:**
- Create: `scripts/doctor/checks/env.mjs`
- Test: `scripts/doctor/checks/env.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/doctor/checks/env.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { parseEnvKeys, checkEnv } from "./env.mjs";

describe("parseEnvKeys", () => {
  it("returns the keys of assignment lines", () => {
    expect(parseEnvKeys("A=1\nB=two")).toEqual(["A", "B"]);
  });

  it("ignores comments, so commented keys read as optional", () => {
    expect(parseEnvKeys("# NEXT_PUBLIC_SITE_URL=x\nA=1")).toEqual(["A"]);
  });

  it("ignores blank lines and surrounding whitespace", () => {
    expect(parseEnvKeys("\n  A = 1  \n\n")).toEqual(["A"]);
  });
});

describe("checkEnv", () => {
  it("fails when the local file is absent and reports every required key", () => {
    const result = checkEnv({ exampleBody: "A=x\nB=y", localBody: null });
    expect(result.status).toBe("fail");
    expect(result.reason).toBe("no-file");
    expect(result.missing).toEqual(["A", "B"]);
  });

  it("names exactly the keys that are missing", () => {
    const result = checkEnv({ exampleBody: "A=x\nB=y", localBody: "A=real" });
    expect(result.status).toBe("fail");
    expect(result.reason).toBe("missing-keys");
    expect(result.missing).toEqual(["B"]);
  });

  it("passes when every required key is present", () => {
    const result = checkEnv({
      exampleBody: "A=x\nB=y",
      localBody: "B=real\nA=real",
    });
    expect(result.status).toBe("pass");
    expect(result.missing).toEqual([]);
  });

  it("does not require keys that are commented out in the example", () => {
    const result = checkEnv({
      exampleBody: "A=x\n# OPTIONAL=y",
      localBody: "A=real",
    });
    expect(result.status).toBe("pass");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/doctor/checks/env.test.mjs`

Expected: FAIL — `Failed to load .../env.mjs` (the module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/doctor/checks/env.mjs`:

```js
/**
 * Environment check: .env.example is the contract, .env.local is the answer.
 *
 * .env.local is gitignored, so it never travels between machines. A fresh
 * clone or a second device starts without it and the app fails at runtime
 * rather than at setup. This check names the exact missing keys.
 */

/** Keys of the assignment lines in a dotenv body. Commented lines are optional. */
export function parseEnvKeys(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .filter((line) => line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter((key) => key.length > 0);
}

/**
 * @param {{exampleBody: string, localBody: string | null}} input
 *   localBody is null when .env.local does not exist.
 */
export function checkEnv({ exampleBody, localBody }) {
  const required = parseEnvKeys(exampleBody);

  if (localBody === null) {
    return { status: "fail", reason: "no-file", missing: required };
  }

  const present = new Set(parseEnvKeys(localBody));
  const missing = required.filter((key) => !present.has(key));

  return {
    status: missing.length > 0 ? "fail" : "pass",
    reason: missing.length > 0 ? "missing-keys" : null,
    missing,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/doctor/checks/env.test.mjs`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor/checks/env.mjs scripts/doctor/checks/env.test.mjs
git commit -m "feat(doctor): env check that names the exact missing keys"
```

---

## Task 4: Doctor check — dependency freshness, hooks, toolchain

Three small pure checks in one task; each is a handful of lines.

**Files:**
- Create: `scripts/doctor/checks/deps.mjs`
- Create: `scripts/doctor/checks/hooks.mjs`
- Create: `scripts/doctor/checks/toolchain.mjs`
- Test: `scripts/doctor/checks/deps.test.mjs`
- Test: `scripts/doctor/checks/hooks.test.mjs`
- Test: `scripts/doctor/checks/toolchain.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/doctor/checks/deps.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { isDepsStale } from "./deps.mjs";

describe("isDepsStale", () => {
  it("is stale when nothing has been installed", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: null })).toBe(true);
  });

  it("is stale when the lockfile is newer than the last install", () => {
    expect(isDepsStale({ lockMtimeMs: 200, modulesMtimeMs: 100 })).toBe(true);
  });

  it("is fresh when the install came after the lockfile", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 200 })).toBe(false);
  });

  it("is fresh when the timestamps match exactly", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 100 })).toBe(false);
  });
});
```

Create `scripts/doctor/checks/hooks.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { isHooksPathConfigured } from "./hooks.mjs";

describe("isHooksPathConfigured", () => {
  it("accepts the repo hooks directory", () => {
    expect(isHooksPathConfigured(".githooks")).toBe(true);
  });

  it("tolerates trailing whitespace from git output", () => {
    expect(isHooksPathConfigured(".githooks\n")).toBe(true);
  });

  it("rejects an unset value", () => {
    expect(isHooksPathConfigured("")).toBe(false);
  });

  it("rejects a different hooks directory", () => {
    expect(isHooksPathConfigured(".husky")).toBe(false);
  });
});
```

Create `scripts/doctor/checks/toolchain.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import {
  expectedNodeMajor,
  expectedPnpmVersion,
  majorOf,
} from "./toolchain.mjs";

describe("majorOf", () => {
  it("reads the major from a plain version", () => {
    expect(majorOf("11.12.0")).toBe(11);
  });

  it("tolerates the v prefix that node -v prints", () => {
    expect(majorOf("v24.14.1")).toBe(24);
  });
});

describe("expectedNodeMajor", () => {
  it("reads the first number out of an engines range", () => {
    expect(expectedNodeMajor({ engines: { node: ">=24" } })).toBe(24);
  });

  it("is null when engines is absent", () => {
    expect(expectedNodeMajor({})).toBe(null);
  });
});

describe("expectedPnpmVersion", () => {
  it("reads the pinned version from packageManager", () => {
    expect(expectedPnpmVersion({ packageManager: "pnpm@11.12.0" })).toBe(
      "11.12.0",
    );
  });

  it("is null for a different package manager", () => {
    expect(expectedPnpmVersion({ packageManager: "yarn@4.0.0" })).toBe(null);
  });

  it("is null when packageManager is absent", () => {
    expect(expectedPnpmVersion({})).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/doctor/checks/`

Expected: FAIL — three "Failed to load" errors for the missing modules.

- [ ] **Step 3: Write the implementations**

Create `scripts/doctor/checks/deps.mjs`:

```js
/**
 * Dependency freshness. A pull that changes pnpm-lock.yaml leaves node_modules
 * behind until the next install, which surfaces as bizarre missing-module
 * errors rather than an obvious "run pnpm install".
 */

/**
 * @param {{lockMtimeMs: number, modulesMtimeMs: number | null}} input
 *   modulesMtimeMs is null when node_modules/.modules.yaml is absent.
 */
export function isDepsStale({ lockMtimeMs, modulesMtimeMs }) {
  if (modulesMtimeMs === null) return true;
  return lockMtimeMs > modulesMtimeMs;
}
```

Create `scripts/doctor/checks/hooks.mjs`:

```js
/**
 * Hook wiring. .git/hooks is never pushed, so the only hooks that survive a
 * machine switch are the ones in .githooks that core.hooksPath points at.
 */

export const HOOKS_PATH = ".githooks";

/** @param {string} configured Raw `git config core.hooksPath` output. */
export function isHooksPathConfigured(configured) {
  return configured.trim() === HOOKS_PATH;
}
```

Create `scripts/doctor/checks/toolchain.mjs`:

```js
/**
 * Toolchain parity between machines. package.json is the single source of
 * truth: `engines.node` for the runtime, `packageManager` for pnpm.
 */

/** Major version number from a version string, with or without a v prefix. */
export function majorOf(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

/** @param {{engines?: {node?: string}}} pkg */
export function expectedNodeMajor(pkg) {
  const match = /(\d+)/.exec(pkg.engines?.node ?? "");
  return match ? Number(match[1]) : null;
}

/** @param {{packageManager?: string}} pkg */
export function expectedPnpmVersion(pkg) {
  const match = /^pnpm@(\d+\.\d+\.\d+)/.exec(pkg.packageManager ?? "");
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/doctor/checks/`

Expected: PASS — 4 files, 22 tests (7 env from Task 3 + 4 deps + 4 hooks + 7 toolchain). The glob picks up `env.test.mjs` too, since it lives in the same directory.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor/checks/
git commit -m "feat(doctor): dependency, hook, and toolchain parity checks"
```

---

## Task 5: Doctor check — Supabase reachability

The project's Supabase instance auto-pauses on the free tier (handoff §2d). Sessions currently burn time discovering this by hitting a broken admin page.

**Files:**
- Create: `scripts/doctor/checks/supabase.mjs`
- Test: `scripts/doctor/checks/supabase.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/doctor/checks/supabase.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { probeSupabase } from "./supabase.mjs";

describe("probeSupabase", () => {
  it("skips when credentials are absent", async () => {
    const result = await probeSupabase({ url: null, key: null });
    expect(result.status).toBe("skip");
  });

  it("reports awake on a successful response", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200 });
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("awake");
  });

  it("reports unreachable on an error response", async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("unreachable");
    expect(result.code).toBe(503);
  });

  it("reports asleep when the request throws or times out", async () => {
    const fetchImpl = async () => {
      throw new Error("aborted");
    };
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("asleep");
  });

  it("sends the anon key as the apikey header", async () => {
    let seen = null;
    const fetchImpl = async (_url, init) => {
      seen = init.headers.apikey;
      return { ok: true, status: 200 };
    };
    await probeSupabase({
      url: "https://x.supabase.co",
      key: "anon-key",
      fetchImpl,
    });
    expect(seen).toBe("anon-key");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/doctor/checks/supabase.test.mjs`

Expected: FAIL — `Failed to load .../supabase.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/doctor/checks/supabase.mjs`:

```js
/**
 * Supabase liveness. The free-tier project sleeps after inactivity; the public
 * site survives on the static seed but auth, reviews, saved tools, and the
 * whole admin need it awake. Knowing this up front beats discovering it
 * halfway through a task.
 *
 * The timeout matches the content layer's own budget in src/lib/content.ts.
 */

const DEFAULT_TIMEOUT_MS = 2500;

/**
 * @param {{
 *   url: string | null,
 *   key: string | null,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} input
 */
export async function probeSupabase({
  url,
  key,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!url || !key) {
    return { status: "skip", reason: "no-credentials" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: controller.signal,
    });
    return response.ok
      ? { status: "awake", code: response.status }
      : { status: "unreachable", code: response.status };
  } catch {
    return { status: "asleep", reason: "timeout-or-network" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/doctor/checks/supabase.test.mjs`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor/checks/supabase.mjs scripts/doctor/checks/supabase.test.mjs
git commit -m "feat(doctor): supabase liveness probe with a 2.5s budget"
```

---

## Task 6: Doctor check — git in-flight state

This is what replaces "read 400 lines of prose to find out what was in flight."

**Files:**
- Create: `scripts/doctor/checks/git.mjs`
- Test: `scripts/doctor/checks/git.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/doctor/checks/git.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { parseAheadBehind, countDirtyFiles } from "./git.mjs";

describe("parseAheadBehind", () => {
  // `git rev-list --left-right --count origin/main...HEAD` prints "behind<TAB>ahead".
  it("reads behind and ahead from the counts", () => {
    expect(parseAheadBehind("3\t5\n")).toEqual({ behind: 3, ahead: 5 });
  });

  it("reads a synced branch as zero and zero", () => {
    expect(parseAheadBehind("0\t0\n")).toEqual({ behind: 0, ahead: 0 });
  });

  it("falls back to zero when there is no upstream to compare", () => {
    expect(parseAheadBehind("")).toEqual({ behind: 0, ahead: 0 });
  });
});

describe("countDirtyFiles", () => {
  it("counts each porcelain line", () => {
    expect(countDirtyFiles(" M src/a.ts\n?? src/b.ts\n")).toBe(2);
  });

  it("counts a clean tree as zero", () => {
    expect(countDirtyFiles("")).toBe(0);
  });

  it("ignores trailing blank lines", () => {
    expect(countDirtyFiles(" M src/a.ts\n\n")).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/doctor/checks/git.test.mjs`

Expected: FAIL — `Failed to load .../git.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/doctor/checks/git.mjs`:

```js
/**
 * In-flight state, derived rather than written down.
 *
 * A hand-maintained "current status" section drifts the moment someone forgets
 * to update it. Git already knows what is unfinished, so ask git.
 */

/** @param {string} output From `git rev-list --left-right --count <upstream>...HEAD`. */
export function parseAheadBehind(output) {
  const [behind, ahead] = output.trim().split(/\s+/).map(Number);
  return {
    behind: Number.isFinite(behind) ? behind : 0,
    ahead: Number.isFinite(ahead) ? ahead : 0,
  };
}

/** @param {string} porcelain From `git status --porcelain`. */
export function countDirtyFiles(porcelain) {
  return porcelain.split(/\r?\n/).filter((line) => line.trim().length > 0)
    .length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/doctor/checks/git.test.mjs`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor/checks/git.mjs scripts/doctor/checks/git.test.mjs
git commit -m "feat(doctor): derive in-flight state from git"
```

---

## Task 7: The doctor CLI

**Files:**
- Create: `scripts/doctor.mjs`

- [ ] **Step 1: Write the CLI**

Create `scripts/doctor.mjs`:

```js
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
import { execFileSync } from "node:child_process";
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
const record = (name, status, detail) =>
  checks.push({ name, status, detail });

// --- toolchain -------------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
const nodeMajor = expectedNodeMajor(pkg);
const pnpmVersion = expectedPnpmVersion(pkg);
const runningNodeMajor = majorOf(process.version);
const runningPnpm = run("pnpm", ["--version"]);

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
  record("toolchain", "pass", `node ${process.version}, pnpm ${runningPnpm}`);
}

// --- dependencies ----------------------------------------------------------
const depsStale = isDepsStale({
  lockMtimeMs: mtimeMs("pnpm-lock.yaml") ?? 0,
  modulesMtimeMs: mtimeMs("node_modules/.modules.yaml"),
});

if (depsStale && FIX) {
  console.log("fixing: pnpm install");
  try {
    execFileSync("pnpm", ["install"], { cwd: ROOT, stdio: "inherit" });
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

record(
  "supabase",
  probe.status === "awake" ? "pass" : "warn",
  {
    awake: "project is awake",
    asleep: "project is paused or unreachable — resume it before touching auth, reviews, or admin",
    unreachable: `REST root returned ${probe.code}`,
    skip: "no credentials in .env.local — skipped",
  }[probe.status],
);

// --- in-flight state -------------------------------------------------------
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const upstream = run("git", [
  "rev-parse",
  "--abbrev-ref",
  "--symbolic-full-name",
  "@{u}",
]);
const { ahead, behind } = parseAheadBehind(
  upstream ? run("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]) : "",
);
const dirty = countDirtyFiles(run("git", ["status", "--porcelain"]));
const lastCommit = run("git", ["log", "-1", "--format=%h %s"]);

const inFlight = { branch, upstream, ahead, behind, dirty, lastCommit };

// --- report ----------------------------------------------------------------
const failed = checks.filter((c) => c.status === "fail");

if (JSON_OUT) {
  console.log(JSON.stringify({ checks, inFlight, ok: failed.length === 0 }, null, 2));
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
```

- [ ] **Step 2: Run it and confirm a clean report**

Run: `pnpm doctor`

Expected: five PASS/WARN lines (toolchain, deps, env, hooks, supabase), an "In flight" block naming branch `main` and the last commit, and exit 0. The supabase line may read WARN if the project is paused — that is correct behavior, not a bug.

- [ ] **Step 3: Prove the env check actually catches a missing file**

```bash
mv .env.local .env.local.bak
pnpm doctor
mv .env.local.bak .env.local
```

Expected: the middle command prints `FAIL  env  .env.local is missing — needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY` and exits non-zero. This is exactly the failure that went undetected at the start of today's session.

- [ ] **Step 4: Confirm the JSON mode parses**

Run: `pnpm doctor --json`

Expected: valid JSON with `checks`, `inFlight`, and `ok` keys.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor.mjs
git commit -m "feat(doctor): converge the machine and report in-flight state"
```

---

## Task 8: The versioned pre-commit hook

**Files:**
- Create: `scripts/hooks/should-verify.mjs`
- Create: `scripts/hooks/pre-commit.mjs`
- Create: `.githooks/pre-commit`
- Test: `scripts/hooks/should-verify.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/hooks/should-verify.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { shouldVerify } from "./should-verify.mjs";

describe("shouldVerify", () => {
  it("runs the gate for TypeScript changes", () => {
    expect(shouldVerify(["src/lib/content.ts"])).toBe(true);
  });

  it("runs the gate for component changes", () => {
    expect(shouldVerify(["src/components/shared/tool-card.tsx"])).toBe(true);
  });

  it("runs the gate for stylesheet changes", () => {
    expect(shouldVerify(["src/app/globals.css"])).toBe(true);
  });

  it("runs the gate when dependencies change", () => {
    expect(shouldVerify(["package.json"])).toBe(true);
  });

  it("runs the gate for the scripts that back it", () => {
    expect(shouldVerify(["scripts/doctor.mjs"])).toBe(true);
  });

  it("skips the gate for a docs-only commit", () => {
    expect(shouldVerify(["handoff.md", "docs/superpowers/plans/x.md"])).toBe(
      false,
    );
  });

  it("skips the gate for image-only commits", () => {
    expect(shouldVerify(["public/screenshots/cursor/hero.png"])).toBe(false);
  });

  it("runs the gate when a commit mixes docs and code", () => {
    expect(shouldVerify(["handoff.md", "src/lib/seo.ts"])).toBe(true);
  });

  it("skips the gate for an empty stage", () => {
    expect(shouldVerify([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/hooks/should-verify.test.mjs`

Expected: FAIL — `Failed to load .../should-verify.mjs`.

- [ ] **Step 3: Write the decision function**

Create `scripts/hooks/should-verify.mjs`:

```js
/**
 * Whether a staged change is worth the ~30s gate.
 *
 * Enki's history is roughly a third documentation commits. Paying for a full
 * typecheck/lint/test run to commit a handoff edit trains people to reach for
 * --no-verify, which is worse than a slightly narrower gate.
 */
const CODE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|sass|json)$/i;

/** @param {string[]} stagedFiles Repo-relative paths from `git diff --cached`. */
export function shouldVerify(stagedFiles) {
  return stagedFiles.some((file) => CODE_PATTERN.test(file));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/hooks/should-verify.test.mjs`

Expected: PASS, 9 tests.

- [ ] **Step 5: Write the hook body**

Create `scripts/hooks/pre-commit.mjs`:

```js
#!/usr/bin/env node
/**
 * Pre-commit gate. Invoked through .githooks/pre-commit, which git finds via
 * core.hooksPath — so unlike anything in .git/hooks, this travels between
 * machines through a normal pull.
 *
 * Bypass with `git commit --no-verify` when you genuinely need to; CI still
 * runs the same gate on push.
 */
import { execFileSync } from "node:child_process";
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
  execFileSync("pnpm", ["verify"], { stdio: "inherit" });
} catch {
  console.error(
    "\npre-commit: `pnpm verify` failed. Fix it, or commit with --no-verify if you know what you are doing.",
  );
  process.exit(1);
}
```

- [ ] **Step 6: Write the hook shim**

Create `.githooks/pre-commit`:

```sh
#!/bin/sh
# Versioned pre-commit hook.
#
# Git runs this because core.hooksPath points at .githooks (wired by the
# `prepare` script on every pnpm install). The real logic lives in Node so it
# behaves identically on Windows and macOS.
exec node "$(git rev-parse --show-toplevel)/scripts/hooks/pre-commit.mjs"
```

- [ ] **Step 7: Mark the shim executable in the index**

Git on Windows will not set the exec bit from the filesystem, and a hook without it is silently ignored on macOS/Linux.

```bash
git add .githooks/pre-commit
git update-index --chmod=+x .githooks/pre-commit
git ls-files -s .githooks/pre-commit
```

Expected: the mode reads `100755`, not `100644`.

- [ ] **Step 8: Prove the hook fires and the skip path works**

```bash
git add scripts/hooks/ .githooks/
git commit -m "feat(hooks): versioned pre-commit gate that travels between machines"
```

Expected: the commit prints `pre-commit: running pnpm verify`, the gate passes, and the commit succeeds.

- [ ] **Step 9: Prove the docs-only skip**

```bash
printf '\n' >> handoff.md
git add handoff.md
git commit -m "chore: confirm the docs-only skip path"
git reset --soft HEAD~1 && git restore --staged handoff.md && git checkout handoff.md
```

Expected: the commit prints `pre-commit: no code staged, skipping the gate` and completes without running the gate. The final line undoes the throwaway commit.

---

## Task 9: CI backstop

`main` auto-deploys to Vercel, so CI is the only machine-independent thing standing between a bad commit and production.

**Files:**
- Create: `.github/workflows/verify.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/verify.yml`:

```yaml
name: verify

# main auto-deploys to Vercel, so this is the last gate before production.
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Reads the pinned version from package.json's packageManager field.
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # No secrets needed: the suite stubs Supabase (src/test/supabase-stub.ts)
      # and never reads .env.local.
      - run: pnpm verify
```

- [ ] **Step 2: Confirm the suite really is env-independent**

The workflow claims tests need no secrets. Verify that locally rather than discovering it in CI:

```bash
mv .env.local .env.local.bak
pnpm test
mv .env.local.bak .env.local
```

Expected: `Tests 121 passed` (plus the new script tests) with no `.env.local` present.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify.yml
git commit -m "ci: verify gate on push and pull request to main"
```

---

## Task 10: Visual sweep report formatting

The sweep's browser half cannot be unit-tested, so the logic that *can* be is extracted first.

**Files:**
- Create: `scripts/visual-sweep/report.mjs`
- Test: `scripts/visual-sweep/report.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/visual-sweep/report.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { dedupeProblems, summarize } from "./report.mjs";

const problem = (container, child) => ({
  container,
  child,
  overflowRight: 12,
  overflowLeft: 0,
});

describe("dedupeProblems", () => {
  it("collapses repeats of the same container and child pair", () => {
    const problems = [
      problem("div.card", "span.badge"),
      problem("div.card", "span.badge"),
    ];
    expect(dedupeProblems(problems)).toHaveLength(1);
  });

  it("keeps distinct pairs", () => {
    const problems = [
      problem("div.card", "span.badge"),
      problem("div.card", "span.price"),
    ];
    expect(dedupeProblems(problems)).toHaveLength(2);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeProblems([])).toEqual([]);
  });
});

describe("summarize", () => {
  it("passes when every route is clean", () => {
    const result = summarize([
      { route: "/", viewport: "narrow", consoleErrors: [], problems: [] },
    ]);
    expect(result.ok).toBe(true);
    expect(result.failureCount).toBe(0);
  });

  it("fails when a console error is present", () => {
    const result = summarize([
      {
        route: "/",
        viewport: "narrow",
        consoleErrors: ["boom"],
        problems: [],
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("fails when an element overflows its clipping container", () => {
    const result = summarize([
      {
        route: "/tools",
        viewport: "wide",
        consoleErrors: [],
        problems: [problem("div.card", "span.badge")],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureCount).toBe(1);
  });

  it("counts each failing route and viewport separately", () => {
    const result = summarize([
      { route: "/", viewport: "narrow", consoleErrors: ["a"], problems: [] },
      {
        route: "/",
        viewport: "wide",
        consoleErrors: [],
        problems: [problem("div.card", "span.badge")],
      },
    ]);
    expect(result.failureCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/visual-sweep/report.test.mjs`

Expected: FAIL — `Failed to load .../report.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/visual-sweep/report.mjs`:

```js
/**
 * Pure reporting half of the visual sweep, so the decision logic is testable
 * without booting a browser.
 */

/** Collapse duplicate container/child pairs, which repeat across list items. */
export function dedupeProblems(problems) {
  const seen = new Set();
  return problems.filter((problem) => {
    const key = `${problem.container}>>${problem.child}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {Array<{
 *   route: string,
 *   viewport: string,
 *   consoleErrors: string[],
 *   problems: object[],
 * }>} results
 */
export function summarize(results) {
  const failures = results.filter(
    (result) => result.consoleErrors.length > 0 || result.problems.length > 0,
  );
  return { ok: failures.length === 0, failureCount: failures.length, failures };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/visual-sweep/report.test.mjs`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/visual-sweep/
git commit -m "feat(sweep): pure dedupe and summary logic for sweep findings"
```

---

## Task 11: The visual sweep harness

Replaces the measurement JavaScript that currently gets rewritten from scratch every session.

**Files:**
- Create: `scripts/visual-sweep.mjs`

- [ ] **Step 1: Write the harness**

Create `scripts/visual-sweep.mjs`:

```js
#!/usr/bin/env node
/**
 * `pnpm sweep` — the Visual Sweep from CLAUDE.md, as a command.
 *
 * Loads each route in a real Chromium at a narrow and a wide viewport, then
 * proves three things: the console is clean, the page does not scroll
 * horizontally, and nothing overflows a container that clips.
 *
 * That last check is the generalized form of the bug this rule exists for: a
 * pricing badge overflowed its card, `overflow-hidden` clipped it, and the
 * rendered HTML looked perfectly fine. Measuring child.right against
 * container.right is what catches it.
 *
 * Intentional clipping (carousels, marquees) is opted out with a
 * `data-sweep-ignore` attribute on the clipping container.
 *
 * Usage:
 *   pnpm sweep                                  # / and /tools
 *   pnpm sweep -- /tools/cursor /best/writing   # explicit routes
 *   pnpm sweep -- --base http://localhost:3100 /
 */
import { chromium } from "@playwright/test";
import { dedupeProblems, summarize } from "./visual-sweep/report.mjs";

const VIEWPORTS = [
  { name: "narrow", width: 390, height: 844 },
  { name: "wide", width: 1440, height: 900 },
];

const argv = process.argv.slice(2);
const baseIndex = argv.indexOf("--base");
const base =
  baseIndex === -1 ? "http://localhost:3000" : argv[baseIndex + 1];
const routes = argv.filter(
  (arg, index) =>
    arg.startsWith("/") && index !== baseIndex && index !== baseIndex + 1,
);
const targets = routes.length > 0 ? routes : ["/", "/tools"];

/**
 * Find children escaping a clipping container. Runs in page context, so it is
 * written as a self-contained function body with no imports.
 */
const CLIP_PROBE = () => {
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const problems = [];

  for (const el of document.querySelectorAll("*")) {
    if (el.closest("[data-sweep-ignore]")) continue;

    const style = getComputedStyle(el);
    if (!/hidden|clip/.test(style.overflowX)) continue;

    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    for (const child of el.querySelectorAll("*")) {
      const childBox = child.getBoundingClientRect();
      if (childBox.width === 0 || childBox.height === 0) continue;
      if (getComputedStyle(child).position === "fixed") continue;

      const overflowRight = childBox.right - box.right;
      const overflowLeft = box.left - childBox.left;

      if (overflowRight > 1 || overflowLeft > 1) {
        problems.push({
          container: describe(el),
          child: describe(child),
          overflowRight: Math.round(overflowRight),
          overflowLeft: Math.round(overflowLeft),
        });
      }
    }
  }

  return problems;
};

const browser = await chromium.launch();
const results = [];

for (const route of targets) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    const url = `${base}${route}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    } catch (error) {
      console.error(`\nCould not load ${url}`);
      console.error(`  ${error.message}`);
      console.error(`  Is the server running? Try: pnpm dev\n`);
      await browser.close();
      process.exit(1);
    }

    // Let entrance animations settle before measuring.
    await page.waitForTimeout(600);

    const problems = dedupeProblems(await page.evaluate(CLIP_PROBE));

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (documentOverflow > 1) {
      problems.push({
        container: "document",
        child: "(page)",
        overflowRight: documentOverflow,
        overflowLeft: 0,
      });
    }

    results.push({
      route,
      viewport: viewport.name,
      consoleErrors,
      problems,
    });

    await context.close();
  }
}

await browser.close();

const summary = summarize(results);

console.log(`\nVisual sweep — ${base}\n`);
for (const result of results) {
  const clean =
    result.consoleErrors.length === 0 && result.problems.length === 0;
  console.log(
    `  ${clean ? "PASS" : "FAIL"}  ${result.route} @ ${result.viewport}`,
  );
  for (const error of result.consoleErrors) {
    console.log(`          console: ${error}`);
  }
  for (const problem of result.problems) {
    const direction =
      problem.overflowRight > 1
        ? `${problem.overflowRight}px past the right edge`
        : `${problem.overflowLeft}px past the left edge`;
    console.log(
      `          ${problem.child} escapes ${problem.container} by ${direction}`,
    );
  }
}

console.log(
  summary.ok
    ? "\nSweep clean.\n"
    : `\n${summary.failureCount} route/viewport combination(s) failed.\n`,
);

process.exit(summary.ok ? 0 : 1);
```

- [ ] **Step 2: Start a server to sweep against**

```bash
pnpm dev
```

Leave it running. Note the port it prints (3000 unless taken).

- [ ] **Step 3: Calibrate against the real app**

Run: `pnpm sweep`

This first run is **calibration, not a verdict.** Enki uses embla carousels and a marquee, which clip children on purpose, so expect findings that are not bugs. For each reported container, decide:

- **Intentional clipping** (carousel viewport, marquee, ticker) → add `data-sweep-ignore` to that container element in its component.
- **A real bug** → fix the layout.

Record which containers you annotate and why in the commit message.

- [ ] **Step 4: Re-run until the sweep is clean**

Run: `pnpm sweep`

Expected: `PASS` for `/` and `/tools` at both viewports, and `Sweep clean.` A clean baseline is what makes future failures meaningful.

- [ ] **Step 5: Prove it catches a real regression**

Temporarily break a card by adding a wide child. In `src/components/shared/tool-card.tsx`, add this inside the outermost card element:

```tsx
<span style={{ position: "absolute", left: 0, width: "200%" }}>overflow probe</span>
```

Run: `pnpm sweep -- /tools`

Expected: FAIL for `/tools`, naming the escaping span and the pixel overflow. **Then remove the probe** and re-run to confirm PASS. A guard that has never failed is not a guard.

- [ ] **Step 6: Commit**

```bash
git add scripts/visual-sweep.mjs src/components
git commit -m "feat(sweep): browser harness proving layout containment at two viewports"
```

---

## Task 12: Promote the sharpest gotcha into a test

Handoff §10 gotcha #1 calls `.upsert()` under anon RLS "the #1 non-obvious backend trap." It already bit the newsletter once. Prose cannot stop it happening again.

**Files:**
- Create: `src/lib/supabase/anon-writes.test.ts`

- [ ] **Step 1: Write the test**

Create `src/lib/supabase/anon-writes.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Anonymous write paths must use .insert(), never .upsert().
 *
 * supabase-js .insert() defaults to return=minimal, so it needs no SELECT and
 * works under an anon-insert-only policy. .upsert() asks for a representation,
 * which needs SELECT, and fails silently where anon has no read policy. This
 * broke the newsletter signup once already (handoff.md §10, gotcha 1).
 */
const ANON_WRITE_PATHS = [
  "src/app/actions/newsletter.ts",
  "src/app/submit/actions.ts",
  "src/app/go/[slug]/route.ts",
];

describe("anonymous write paths", () => {
  it.each(ANON_WRITE_PATHS)("%s writes with .insert(), not .upsert()", (path) => {
    expect(readFileSync(path, "utf8")).not.toContain(".upsert(");
  });

  it.each(ANON_WRITE_PATHS)("%s still exists at the audited path", (path) => {
    expect(() => readFileSync(path, "utf8")).not.toThrow();
  });
});
```

The second assertion matters: if a file is renamed, the first test would pass vacuously against a path that no longer exists.

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/lib/supabase/anon-writes.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 3: Verify it fails on the mistake it guards**

Temporarily change `.insert(` to `.upsert(` in `src/app/actions/newsletter.ts`, then run the same command.

Expected: FAIL naming `src/app/actions/newsletter.ts`. **Revert the change** and re-run to confirm PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/anon-writes.test.ts
git commit -m "test(supabase): guard anon write paths against the upsert trap"
```

---

## Task 13: Enki-specific Claude skills

The four existing skills are generic code-review-graph wrappers. These three encode workflows that are specific to this project.

**Files:**
- Create: `.claude/skills/enki-session-start/SKILL.md`
- Create: `.claude/skills/enki-visual-sweep/SKILL.md`
- Create: `.claude/skills/enki-supabase-change/SKILL.md`

- [ ] **Step 1: Write the session-start skill**

Create `.claude/skills/enki-session-start/SKILL.md`:

```markdown
---
name: enki-session-start
description: Use at the start of any Enki session, or after a git pull, to converge the machine and learn what is in flight before doing any other work
---

## Enki Session Start

Enki is developed on two machines that sync through GitHub roughly twice a day.
Anything gitignored or unversioned drifts between them. Establish ground truth
from a command, not from reading `handoff.md` end to end.

### Steps

1. Run `pnpm doctor`.
2. Act on each failing check:

| Check | Failure means | Do this |
|---|---|---|
| `toolchain` | Node major differs from `engines.node` | Tell the user; do not try to switch runtimes silently |
| `deps` | `node_modules` is older than the lockfile | Run `pnpm install` |
| `env` | `.env.local` is absent or short of keys | The required values are in `handoff.md` §2a. Never invent them |
| `hooks` | `core.hooksPath` is unset | Run `pnpm doctor --fix` |
| `supabase` | The project is paused | Resume it before touching auth, reviews, saved tools, collections, or admin. The public site runs on the seed and is fine |

3. Read the "In flight" block for branch, divergence from origin, uncommitted
   file count, and the last commit. That is the state of play.
4. Only read `handoff.md` when you need architecture, design language, or
   conventions. Do not read it to learn current status.

### Notes

- `pnpm doctor --fix` repairs hooks and dependencies and creates `.env.local`
  from `.env.example`. It cannot know the secret values, so a created file
  still needs filling in.
- A WARN never blocks work. Only a FAIL does.
```

- [ ] **Step 2: Write the visual sweep skill**

Create `.claude/skills/enki-visual-sweep/SKILL.md`:

~~~~markdown
---
name: enki-visual-sweep
description: Use after changing any .tsx, .jsx, .css, or .scss file in Enki, before claiming the work is complete or committing
---

## Enki Visual Sweep

CLAUDE.md makes a browser sweep mandatory for visual changes. `pnpm sweep` is
that sweep. Do not hand-write measurement JavaScript; the harness already does
it, and it is consistent between sessions.

### Steps

1. Start a server: `preview_start` with `{ name: "enki-dev" }`, or `pnpm dev`.
2. Run the sweep against the routes you touched, plus the two always-check pages:

   ```bash
   pnpm sweep -- / /tools /tools/cursor
   ```

   Pass `--base http://localhost:PORT` if the server did not take 3000.
3. Read the output. Every route/viewport pair must read PASS.
4. On a failure, the report names the escaping element, its clipping container,
   and the pixel overflow. Fix the layout and re-run.
5. Cite the actual output when you report the work as done.

### What it checks

At 390px and 1440px, for every route:

- Zero console errors and zero page errors.
- No horizontal document overflow.
- No element escaping a container that clips (`overflow-x: hidden|clip`) by
  more than 1px. This is the generalized form of the pricing-badge bug that
  the rule exists for.

### Intentional clipping

Carousels, marquees, and tickers clip children on purpose. Mark those
containers with `data-sweep-ignore`; the probe skips them and their subtrees.
Only add it where clipping is genuinely the design, never to silence a real
failure.

### Limits

The sweep proves containment and console cleanliness. It does not judge whether
something looks good, and it does not check colour, spacing, or typography. For
those, take a screenshot.
~~~~

- [ ] **Step 3: Write the Supabase change skill**

Create `.claude/skills/enki-supabase-change/SKILL.md`:

```markdown
---
name: enki-supabase-change
description: Use before writing any Supabase query, migration, RLS policy, or grant in Enki - encodes traps that have already cost this project real time
---

## Enki Supabase Change

Every rule here comes from a bug that already shipped. `handoff.md` §4 and §10
have the long version.

### Before writing a query

- **Anonymous writes use `.insert()`, never `.upsert()`.** `.insert()` defaults
  to `return=minimal`, needs no SELECT, and works under an anon-insert-only
  policy. `.upsert()` returns a representation, needs SELECT, and fails
  *silently* where anon has no read policy. Treat a unique violation
  (`error.code === "23505"`) as a friendly no-op.
  `src/lib/supabase/anon-writes.test.ts` enforces this.
- **Query builders are lazy thenables.** `void supabase.from(...).insert(...)`
  never runs. Always `await` it or call `.then()`.
- **Content getters in `src/lib/content.ts` are async.** Await them.

### Before writing a migration

- **Never `grant update on public.reviews`.** Table-level INSERT/UPDATE were
  revoked and re-granted per column specifically so `reviews.status` stays
  unwritable over PostgREST. A table-level grant silently reopens the review
  self-approval bypass. Adding a column to `reviews` means granting that column
  explicitly.
- **`revoke execute ... from anon` on a function is a no-op.** Postgres grants
  EXECUTE to PUBLIC, and `anon` inherits it. Revoke from `public`, then
  re-grant to the roles you intend. Verify with `select proacl from pg_proc`;
  a leading `=X/postgres` entry is the PUBLIC grant.
- **`is_admin()` must stay PUBLIC-executable.** It runs inside RLS policies
  that anonymous readers hit (`published OR is_admin()` on `tools`), and policy
  expressions evaluate with the caller's privileges. Revoking it breaks the
  public site.

### Before writing a server action

- **Every admin server action calls `assertAdmin()` itself.** Server actions
  are public POST endpoints. RLS does not stop an unauthorized caller from
  triggering their side effects.

### Checking your work

- The project is on the free tier and auto-pauses. `pnpm doctor` reports
  whether it is awake.
- Use the Supabase MCP connector for migrations and SQL.
```

- [ ] **Step 4: Confirm the skills are well-formed**

Run: `node -e "const {readFileSync}=require('fs');for(const s of ['enki-session-start','enki-visual-sweep','enki-supabase-change']){const b=readFileSync('.claude/skills/'+s+'/SKILL.md','utf8');if(!b.startsWith('---\n'))throw new Error(s+' missing frontmatter');if(!b.includes('name: '+s))throw new Error(s+' name mismatch');console.log('ok '+s)}"`

Expected: three `ok` lines.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/
git commit -m "docs(skills): Enki-specific session-start, sweep, and Supabase workflows"
```

---

## Task 14: Doc hygiene

Three statements in `handoff.md` are provably false as of this session, and `CLAUDE.md` describes a sweep procedure that is now a command.

**Files:**
- Modify: `handoff.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix the stale `.env.local` claim**

In `handoff.md` §2a, replace:

```
In **`.env.local`** (gitignored, present locally); `.env.example` documents them.
```

with:

```
In **`.env.local`** (gitignored, so it never travels between machines);
`.env.example` documents them and `pnpm doctor` reports exactly which keys a
machine is missing.
```

- [ ] **Step 2: Fix the contradictory deployment status**

In `handoff.md` §5, the stack table's last row reads `Dark only (`class="dark"`); Vercel (not yet deployed)`, which contradicts §1 and §2b. Replace that cell's value with:

```
Dark only (`class="dark"`); Vercel — live, auto-deploys on push to `main`
```

- [ ] **Step 3: Rewrite the stale hook gotcha**

In `handoff.md` §10, replace gotcha 7 in full:

```
7. **Git hooks live in `.githooks/`, not `.git/hooks`.** `.git/hooks` is never
   pushed, so a hook installed by hand on one machine does not exist on the
   other — this is why an earlier pre-commit hook silently vanished. The
   versioned hook is wired by `core.hooksPath`, which the `prepare` script sets
   on every `pnpm install`. `pnpm doctor` reports it if it is unset.
```

- [ ] **Step 4: Replace the volatile gates line**

In `handoff.md` §1, replace:

```
**Gates green:** `typecheck`, `lint`, `build` (**182 routes**), `test`
(**121 tests**).
```

with:

```
**Gates:** `pnpm verify` (typecheck + lint + test) is the gate; `pnpm build` is
authoritative for routing. Counts are deliberately not recorded here — they go
stale. Run the commands.
```

- [ ] **Step 5: Add the two-machine workflow section**

In `handoff.md`, insert this immediately after the `## 3. How to run` code block:

~~~~
### Working across two machines

Enki is developed on two devices that sync through GitHub. Everything
gitignored (`.env.local`) or unversioned (`.git/hooks`, `node_modules`) drifts
between them silently.

```bash
git pull
pnpm install     # also wires core.hooksPath -> .githooks via `prepare`
pnpm doctor      # env, deps, hooks, toolchain, Supabase, and what is in flight
```

`pnpm doctor --fix` repairs hooks and dependencies and creates a missing
`.env.local` from `.env.example`. It cannot know the secret values; fill them
from §2a. End the day with a normal commit — the pre-commit hook runs
`pnpm verify` for code changes and skips it for docs-only commits.
~~~~

- [ ] **Step 6: Point CLAUDE.md's sweep rule at the command**

In `CLAUDE.md`, replace the entire `### The sweep (do every step; cite what you checked)` section, from that heading down to (but not including) `### Why this rule exists`, with:

~~~~
### The sweep

Run the harness. Do not hand-write measurement JavaScript.

1. **Serve the app.** `preview_start` with `{ name: "enki-dev" }`, or `pnpm dev`.
2. **Sweep the affected routes plus the always-check pages** (`/` and `/tools`):

   ```bash
   pnpm sweep -- / /tools /tools/cursor
   ```

   Add `--base http://localhost:PORT` if the server did not take 3000.
3. **Every route/viewport pair must read PASS.** At 390px and 1440px the sweep
   asserts zero console errors, no horizontal document overflow, and that
   nothing escapes a container that clips.
4. **Cite the output** when you report the work complete. Never assert "no
   regression" without it.

Containers that clip on purpose (carousels, marquees) opt out with
`data-sweep-ignore`. Use it only where clipping is genuinely the design.

The sweep proves containment, not taste. For colour, spacing, and typography,
take a screenshot.
~~~~

- [ ] **Step 7: Document the commands in CLAUDE.md**

Append to the end of `CLAUDE.md`:

```
<!-- project commands -->
## Commands

| Command | Use |
|---|---|
| `pnpm doctor` | Converge this machine and report what is in flight. Run first, every session |
| `pnpm doctor --fix` | Repair hooks and dependencies; create a missing `.env.local` |
| `pnpm verify` | The gate: typecheck + lint + test. The pre-commit hook runs this |
| `pnpm sweep` | The Visual Sweep, as a command. Required after visual changes |
| `pnpm build` | Authoritative production build |

Skills: `enki-session-start`, `enki-visual-sweep`, `enki-supabase-change`.
```

- [ ] **Step 8: Commit**

```bash
git add handoff.md CLAUDE.md
git commit -m "docs: correct stale claims and document the new workflow commands"
```

---

## Task 15: Full verification

- [ ] **Step 1: Run the whole gate**

Run: `pnpm verify`

Expected: typecheck clean, lint clean, and all tests passing — **176 tests across 23 files**: the 121 original in 14 files, plus 55 new in 9 files (7 env + 4 deps + 4 hooks + 7 toolchain + 5 supabase + 6 git + 9 should-verify + 7 report + 6 anon-writes; the anon-writes figure is 3 paths x 2 assertions, already expanded). Record the actual numbers — if they differ from 176, find out why before moving on.

- [ ] **Step 2: Run the doctor**

Run: `pnpm doctor`

Expected: exit 0, with `hooks` reading PASS.

- [ ] **Step 3: Run the sweep against a production build**

The dev server is not what ships. Verify against the real thing:

```bash
pnpm build
npx next start -p 3100
```

In a second shell:

```bash
pnpm sweep -- --base http://localhost:3100 / /tools
```

Expected: `Sweep clean.`

- [ ] **Step 4: Confirm the hook is armed from a clean checkout's perspective**

```bash
git config core.hooksPath
git ls-files -s .githooks/pre-commit
```

Expected: `.githooks`, and mode `100755`.

- [ ] **Step 5: Push and confirm CI is green**

```bash
git push origin main
gh run watch
```

Expected: the `verify` workflow completes successfully. If `gh` is unavailable, check the Actions tab.

- [ ] **Step 6: Report**

State the actual test count, the doctor output, the sweep result, and the CI conclusion. Do not claim success for any step whose output you have not seen.

---

## Notes for the implementer

- **Nothing here needs a new dependency.** Playwright, Vitest, and Node's standard library cover all of it.
- **The calibration step in Task 11 is real work, not a formality.** Enki has carousels and a marquee that clip on purpose. Expect to add several `data-sweep-ignore` attributes, and think about each one — an attribute added to silence a genuine bug defeats the whole harness.
- **Two tasks deliberately break things to prove a guard works** (Task 11 Step 5, Task 12 Step 3). Both say to revert. Do not skip the revert, and do not skip the proof.
- **`prepare` runs on every `pnpm install`,** including in CI. `scripts/install-hooks.mjs` exits 0 outside a git checkout and never fails an install.

---

## Outcome (executed 2026-07-26)

All 15 tasks landed in 16 commits, `8cf121f..de7720e`. Verified results:

| Check | Result |
|---|---|
| `pnpm verify` | typecheck + lint clean, **185 tests in 23 files** |
| `pnpm doctor` | all five checks PASS, exit 0 |
| `pnpm build` | clean, 182 static pages |
| `pnpm sweep` (dev, 8 routes) | clean, 16 route/viewport combinations |
| `pnpm sweep` (production `next start`, 6 routes) | clean, 12 combinations |
| Pre-commit hook | fires on code, skips docs-only, mode `100755`, LF-pinned |
| GitHub Actions `verify` | success on `de7720e` |

The test count is 185, not the 176 this plan predicted. The extra 9 are tests for
defects found *while executing*, each only findable by running the thing:

1. **Supabase 401 misread as unreachable.** The REST root answers 401 to a bare
   apikey header. Any HTTP answer proves the project is serving, so only a 5xx is
   unreachable now. (+1 test)
2. **`pnpm --version` returned empty on Windows.** `execFileSync` cannot resolve
   pnpm's `.cmd` shim by bare name, and reaching it via `shell: true` concatenated
   arguments and mangled `git log --format=%h %s` into `(no commits)`. Now read
   from `npm_config_user_agent`. (+3 tests)
3. **Sweep flagged every decorative glow.** The probe checked out-of-flow
   children; Enki's atmosphere is oversized absolutely-positioned blurs their
   container is meant to clip. In-flow only now — ~45 findings became 4.
4. **`data-sweep-ignore` exempted only the container, not its subtree**, so the
   honeypot's children were still flagged against `body`.
5. **Route arguments were silently dropped.** With no `--base`, `baseIndex` is
   `-1`, so the guard `index !== baseIndex + 1` excluded index 0 and the defaults
   always won. Every documented `pnpm sweep -- /route` invocation was a no-op.
6. **Vercel Analytics 404s failed every route** against a local production
   server. `/_vercel/*` scripts only exist on Vercel's edge; they are filtered
   now, which is what makes `next start` sweepable at all. (+5 tests)

Two things the plan did not anticipate:

- **`.gitattributes` pinning `.githooks/*` to LF.** A CRLF on the shebang line
  makes `sh` fail with `bad interpreter` on macOS/Linux while working fine on
  Windows — it would have broken the hook on the other machine only.
- **Two `data-sweep-ignore` annotations** were needed, not "several": the
  honeypot's 1px off-screen box and the embla screenshot viewport.
