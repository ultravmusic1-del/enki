"use client";

import { useCallback, useSyncExternalStore } from "react";

/* =========================================================================
   Compare selection — an ephemeral "tray" of tools the user is lining up to
   compare. In-memory only (a session accumulator, not a saved preference):
   it survives client navigation but resets on full reload, which matches how
   people use a compare tray. Server snapshot is always empty, so it never
   leaks between requests.
   ========================================================================= */

export const COMPARE_MAX = 4;

const EMPTY: readonly string[] = Object.freeze([]);
let selection: readonly string[] = EMPTY;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => selection;
const getServer = () => EMPTY;

function set(next: readonly string[]) {
  selection = next;
  notify();
}

function add(slug: string) {
  if (selection.includes(slug) || selection.length >= COMPARE_MAX) return;
  set([...selection, slug]);
}
function remove(slug: string) {
  set(selection.filter((s) => s !== slug));
}
function toggle(slug: string) {
  if (selection.includes(slug)) remove(slug);
  else add(slug);
}
function replace(slugs: string[]) {
  set(slugs.slice(0, COMPARE_MAX));
}
function clear() {
  set(EMPTY);
}

export function useCompareSelection() {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, getServer);
  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);
  return {
    slugs,
    count: slugs.length,
    full: slugs.length >= COMPARE_MAX,
    has,
    add,
    remove,
    toggle,
    replace,
    clear,
    max: COMPARE_MAX,
  };
}
