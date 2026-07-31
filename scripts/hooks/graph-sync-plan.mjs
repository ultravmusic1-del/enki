/**
 * Which commit range the knowledge graph should re-parse after a git event.
 *
 * The graph stores the sha it was built at, so an update that re-parses too
 * narrow a range leaves it silently wrong: the status line claims it matches
 * HEAD while the nodes for everything in between are stale. Picking the base
 * per event is the whole job.
 */

/** Events where HEAD can move by more than one commit. */
const WIDE_EVENTS = new Set(["post-merge", "post-rewrite"]);

/**
 * @param {string} event Git hook name, e.g. "post-commit".
 * @param {Set<string>} availableRefs Refs that resolve in this repo right now.
 * @returns {{base: string} | {fullRebuild: true}}
 */
export function graphSyncPlan(event, availableRefs) {
  // A pull or rebase moves HEAD across a whole range at once; ORIG_HEAD is the
  // commit it moved from. HEAD~1 would parse only the final commit of a
  // 66-commit fast-forward.
  if (WIDE_EVENTS.has(event) && availableRefs.has("ORIG_HEAD")) {
    return { base: "ORIG_HEAD" };
  }

  // No parent means the root commit: there is no range to diff, so parse
  // everything.
  if (!availableRefs.has("HEAD~1")) {
    return { fullRebuild: true };
  }

  return { base: "HEAD~1" };
}
