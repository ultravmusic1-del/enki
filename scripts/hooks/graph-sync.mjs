#!/usr/bin/env node
/**
 * Keep the code-review knowledge graph level with HEAD.
 *
 * Invoked from .githooks/post-commit, post-merge and post-rewrite, which git
 * finds via core.hooksPath — so this travels between machines through a normal
 * pull, unlike anything hand-installed in .git/hooks.
 *
 * The graph previously drifted 66 commits behind HEAD because the only thing
 * refreshing it was a PostToolUse hook: edits made outside Claude Code, and
 * every `git pull`, left it stale, and a stale graph answers review questions
 * about code that is no longer there.
 *
 * Never fails the git operation. A graph that did not update is an
 * inconvenience; a commit that did not land because of it is a bug.
 */
import { execFileSync, execSync } from "node:child_process";
import { graphSyncPlan } from "./graph-sync-plan.mjs";

const EVENT = process.argv[2] ?? "post-commit";
const TIMEOUT_MS = 120_000;

if (process.env.CI || process.env.ENKI_SKIP_GRAPH_SYNC) {
  process.exit(0);
}

/** Refs that actually resolve, so the plan never names a missing one. */
function resolvableRefs() {
  const found = new Set();
  for (const ref of ["HEAD~1", "ORIG_HEAD"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
        stdio: "ignore",
      });
      found.add(ref);
    } catch {
      // Unresolvable: root commit, or no merge/rebase has happened yet.
    }
  }
  return found;
}

/**
 * The CLI is a Python entry point, so it is absent on a machine that has the
 * repo but not the tool. That is a normal state, not an error.
 */
function graphCommand() {
  // execSync takes one string through a shell, so it finds the .exe shim on
  // Windows without execFileSync's PATHEXT resolution problem.
  try {
    execSync("code-review-graph --version", { stdio: "ignore", timeout: 30_000 });
    return "code-review-graph";
  } catch {
    // Fall through to the module form: an install that never put its shim on
    // PATH still works if python can import it.
  }

  for (const python of ["python", "python3", "py"]) {
    try {
      execSync(`${python} -m code_review_graph --version`, {
        stdio: "ignore",
        timeout: 30_000,
      });
      return `${python} -m code_review_graph`;
    } catch {
      // Try the next interpreter name.
    }
  }

  return null;
}

const cli = graphCommand();

if (!cli) {
  console.log(
    `${EVENT}: code-review-graph is not installed, leaving the graph alone`,
  );
  process.exit(0);
}

const plan = graphSyncPlan(EVENT, resolvableRefs());
const command = plan.fullRebuild
  ? `${cli} build --quiet`
  : `${cli} update --base ${plan.base} --quiet`;

try {
  execSync(command, { stdio: "inherit", timeout: TIMEOUT_MS });
  console.log(
    plan.fullRebuild
      ? `${EVENT}: knowledge graph rebuilt`
      : `${EVENT}: knowledge graph updated from ${plan.base}`,
  );
} catch (error) {
  // Warn loudly rather than fail. The next commit diffs against its own parent,
  // so it will not pick this range up again — the graph stays behind until
  // someone rebuilds, which is why the message says so out loud.
  console.warn(
    `${EVENT}: knowledge graph update failed (${error.message}). Run \`code-review-graph build\` when convenient.`,
  );
}
