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
- A WARN never blocks work. Only a FAIL does. `pnpm doctor` exits 1 on any FAIL,
  so it is safe to branch on the exit code; `--json` gives the same result
  machine-readably.
- The `supabase` check reads any HTTP answer as awake, including the 401 the
  REST root returns to a bare apikey header. Only a 5xx or no answer at all
  means the project is not serving.
