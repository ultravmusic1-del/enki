"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Read the URL's query string once, after mount, and report when that is done.
 *
 * This exists to replace `useSearchParams()` in components that only need the
 * query string to seed initial state. Calling `useSearchParams()` opts the
 * enclosing Suspense boundary out of the prerender, so the static HTML ships
 * the fallback: /tools served crawlers a grid of skeleton boxes and not one
 * link to a tool. Reading `window.location.search` after mount costs nothing
 * at render time and lets the server emit the real markup.
 *
 * The trade-off is deliberate: a visitor arriving on a filtered link sees the
 * unfiltered view for one frame before the filters apply. Crawlable content is
 * worth more than that frame.
 *
 * Unlike the `useSearchParams()` this replaces, the hook is mount-only and
 * non-reactive: it does not respond to back/forward navigation, `popstate`,
 * or client-side route changes after the initial read.
 *
 * The returned boolean gates any effect that writes state back to the URL.
 * Without it, that effect fires first with default state and wipes the very
 * query string this hook is about to read.
 */
export function useSearchParamsOnMount(
  apply: (params: URLSearchParams) => void,
): boolean {
  // Capture the callback in a ref so the mount effect below can read it
  // without listing it as a dependency. Consumers pass an inline arrow
  // function, which is a new identity on every render; if the effect
  // depended on `apply` directly, react-hooks/exhaustive-deps would demand
  // it be added to the array. The effect's `[]` deps are what keep it from
  // re-running — the ref just lets that empty array satisfy the linter too.
  const applyRef = useRef(apply);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyRef.current(new URLSearchParams(window.location.search));
    // window.location has no server-side equivalent, so this genuinely cannot
    // be derived during render — the rule's "you might not need an effect"
    // premise does not apply. Disabled visibly rather than hidden behind a
    // nested function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  return ready;
}
