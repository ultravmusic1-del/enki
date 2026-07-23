#!/usr/bin/env node
/**
 * PostToolUse guard: when visual code (.tsx/.jsx/.css/.scss) is edited, inject a
 * mandatory "run a visual sweep" reminder into the model's context.
 *
 * This is the enforcement half of the project's Visual Sweep rule (see
 * CLAUDE.md → "Visual Sweep"). The rule itself lives in CLAUDE.md so it is
 * always in context; this hook fires the active reminder the moment visual code
 * changes so it can't be forgotten before claiming work complete or committing.
 *
 * Debounced to once per ~10 minutes per session so a burst of edits during one
 * change doesn't spam the context. Never blocks the tool: any error exits 0
 * silently.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEBOUNCE_MS = 10 * 60 * 1000;
// Files whose edits require a visual sweep before completion.
const VISUAL_RE = /\.(tsx|jsx|css|scss|sass)$/i;

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return; // no stdin — nothing to do
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const input = payload?.tool_input ?? {};
  const filePath = input.file_path ?? input.path ?? "";
  if (typeof filePath !== "string" || !VISUAL_RE.test(filePath)) return;

  // Debounce per session so one change (many edits) reminds at most once.
  const sessionId = String(payload?.session_id ?? "nosession").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const marker = join(tmpdir(), `claude-visual-sweep-${sessionId}.txt`);
  const now = Date.now();
  try {
    if (existsSync(marker)) {
      const last = Number(readFileSync(marker, "utf8").trim());
      if (Number.isFinite(last) && now - last < DEBOUNCE_MS) return;
    }
    writeFileSync(marker, String(now));
  } catch {
    // If the marker can't be read/written, fall through and still remind.
  }

  const name = filePath.split(/[\\/]/).pop() || filePath;
  const additionalContext = [
    `⚠ VISUAL SWEEP REQUIRED — you just changed visual code (${name}).`,
    `Project rule (CLAUDE.md → "Visual Sweep"): before you claim this work complete, say "design preserved", or commit, you MUST run a visual sweep with browser evidence:`,
    `1. Start the preview (preview_start name "enki-dev", or "npx next start" after a build) — do NOT rely on rendered HTML alone.`,
    `2. Load every affected route PLUS / (home) and /tools (directory cards).`,
    `3. read_console_messages — zero errors.`,
    `4. Verify layout: for cards/badges/flex rows, measure with javascript_tool that nothing overflows/clips its container (badge.right <= card.right); check both narrow and wide widths.`,
    `5. Only then report — cite what you checked. Never assert "no regression" without this.`,
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
      },
    }),
  );
}

main();
