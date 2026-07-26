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

   Add `--base http://localhost:PORT` if the server did not take 3000. With no
   routes given it sweeps `/` and `/tools`.
3. Read the output. Every route/viewport pair must read PASS.
4. On a failure, the report names the escaping element, its clipping container,
   and the pixel overflow. Fix the layout and re-run.
5. Cite the actual output when you report the work as done.

### What it checks

At 390px and 1440px, for every route:

- Zero console errors and zero page errors. Requests to `/_vercel/*` are
  filtered out: Vercel Analytics and Speed Insights only serve those scripts on
  Vercel's edge, so against a local `next start` they 404 on every route and
  would fail everything for a reason unrelated to the page.
- No horizontal document overflow.
- No **in-flow** element escaping a container that clips
  (`overflow-x: hidden|clip`) by more than 1px. This is the generalized form of
  the pricing-badge bug that the rule exists for.

Out-of-flow children (absolute, fixed, sticky) are skipped deliberately. Enki's
atmosphere is built from oversized absolutely-positioned blurs that their
container is *meant* to clip, and flagging those buries real findings in noise.

### Intentional clipping

Carousels, marquees, and tickers clip children on purpose. Mark those
containers with `data-sweep-ignore`, which exempts the container **and its whole
subtree**. Two exist today: the honeypot's 1px off-screen box
(`src/components/shared/honeypot.tsx`) and the embla screenshot viewport
(`src/components/detail/screenshot-carousel.tsx`).

Only add it where clipping is genuinely the design, never to silence a real
failure. An attribute added to quiet a bug defeats the whole harness.

### Limits

The sweep proves containment and console cleanliness. It does not judge whether
something looks good, and it does not check colour, spacing, or typography. For
those, take a screenshot.
