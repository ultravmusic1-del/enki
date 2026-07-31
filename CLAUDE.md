<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates twice over: a `PostToolUse` hook catches edits made
   through Claude Code, and the versioned git hooks (`post-commit`,
   `post-merge`, `post-rewrite` → `scripts/hooks/graph-sync.mjs`) catch
   everything else, including a `git pull` from the other machine. Both no-op
   silently if `code-review-graph` is not installed, so on a fresh machine
   check `list_graph_stats_tool` — `head_matches_build: false` means the graph
   is describing code that is no longer there.
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

<!-- visual-sweep rule -->
## Visual Sweep (MANDATORY for visual changes)

**Whenever you implement or edit visual code, you MUST run a visual sweep in a
real browser before claiming the work complete, saying "design preserved / no
regression", or committing.** Type checks, lint, unit tests, and rendered HTML
are necessary but **not sufficient** — they do not catch layout breakage
(overflow, clipping, misalignment, broken responsive behavior). A
`PostToolUse` hook (`.claude/hooks/visual-sweep-guard.mjs`) will remind you the
moment visual code changes; this section is the procedure it refers to.

**"Visual code" =** any `.tsx` / `.jsx` / `.css` / `.scss` file, Tailwind class
changes, component markup/layout, `globals.css`, fonts, or anything that alters
what renders on screen.

### The sweep

Run the harness. Do not hand-write measurement JavaScript — `pnpm sweep` does
it, and it stays consistent between sessions.

1. **Serve the app.** `preview_start` with `{ name: "enki-dev" }`, or `pnpm dev`.
   If the preview harness won't keep the dev server alive, run a production
   server (`pnpm build` then `npx next start -p <port>`).
2. **Sweep the affected routes plus the always-check pages** (`/` and `/tools`):

   ```bash
   pnpm sweep -- / /tools /tools/cursor
   ```

   Add `--base http://localhost:PORT` if the server did not take 3000.
3. **Every route/viewport pair must read PASS.** At 390px and 1440px the sweep
   asserts zero console errors, no horizontal document overflow, and that no
   in-flow element escapes a container that clips.
4. **Cite the output** when you report the work complete. Never assert "no
   regression" without it.

Out-of-flow children (absolute, fixed, sticky) are skipped deliberately: Enki's
atmosphere is built from oversized absolutely-positioned blurs their container
is meant to clip. Containers that clip on purpose — carousels, marquees — opt
out with `data-sweep-ignore`, which exempts the subtree. Use it only where
clipping is genuinely the design, never to silence a real failure.

The sweep proves containment, not taste. For colour, spacing, and typography,
take a screenshot.

### Why this rule exists

A pricing-badge clipping bug shipped on the directory cards because a change was
signed off on rendered-HTML inspection alone, without ever loading the cards in
a browser. Rendered HTML looked correct; the actual flex layout overflowed and
`overflow-hidden` clipped the badge. Measuring `badge.right` vs `card.right` in
the browser catches exactly this class of bug. Assume every visual change can
break layout until the browser proves otherwise.

<!-- project commands -->
## Commands

| Command | Use |
|---|---|
| `pnpm doctor` | Converge this machine and report what is in flight. Run first, every session |
| `pnpm doctor --fix` | Repair hooks and dependencies; create a missing `.env.local` |
| `pnpm verify` | The gate: typecheck + lint + test. The pre-commit hook runs this |
| `pnpm audit:rls` | Prove RLS still blocks anonymous reads of private tables |
| `pnpm sweep` | The Visual Sweep, as a command. Required after visual changes |
| `pnpm build` | Authoritative production build |

Enki is developed on two machines that sync through GitHub, so anything
gitignored or unversioned drifts between them. `pnpm doctor` is how you find out.

Skills: `enki-session-start`, `enki-visual-sweep`, `enki-supabase-change`.
