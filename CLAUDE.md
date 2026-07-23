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

1. The graph auto-updates on file changes (via hooks).
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

### The sweep (do every step; cite what you checked)

1. **Serve the app.** `preview_start` with `{ name: "enki-dev" }`. If the
   preview harness won't keep the dev server alive, run a production server
   (`npm run build` then `npx next start -p <port>`) and open it with
   `preview_start { url: "http://localhost:<port>/..." }` so the in-app browser
   can reach it.
2. **Load the affected routes _plus_ the always-check pages:** `/` (home —
   featured cards + 3D hero) and `/tools` (directory cards). Add any route your
   change touches (e.g. `/tools/<slug>` for detail-page work).
3. **Console must be clean:** `read_console_messages` (onlyErrors) → zero errors.
4. **Prove the layout, don't eyeball it.** If screenshots aren't available
   (pane not compositing), use `javascript_tool` to measure bounding boxes:
   - Cards/badges/flex rows: assert the child stays inside its container
     (e.g. `badge.getBoundingClientRect().right <= card.getBoundingClientRect().right`).
   - Check that truncation engages on long content and that nothing has
     `scrollWidth > clientWidth` where it shouldn't.
   - Test at a narrow and a wide viewport (`resize_window`) for responsive work.
5. **Capture proof** when the pane composites (`computer` screenshot); otherwise
   report the measurements. **Never** assert "no regression" without this.

### Why this rule exists

A pricing-badge clipping bug shipped on the directory cards because a change was
signed off on rendered-HTML inspection alone, without ever loading the cards in
a browser. Rendered HTML looked correct; the actual flex layout overflowed and
`overflow-hidden` clipped the badge. Measuring `badge.right` vs `card.right` in
the browser catches exactly this class of bug. Assume every visual change can
break layout until the browser proves otherwise.
