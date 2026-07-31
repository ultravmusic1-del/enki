"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Read the URL's query string once, after mount, and report when that is done.
 *
 * This exists to replace `useSearchParams()` in components that only need the
 * query string to seed initial state. Calling `useSearchParams()` opts the
 * enclosing Suspense boundary out of the prerender, so the static HTML ships
 * the fallback: /tools served crawlers six grey skeleton boxes and not one link
 * to a tool. Reading `window.location.search` after mount costs nothing at
 * render time and lets the server emit the real markup.
 *
 * The trade-off is deliberate: a visitor arriving on a filtered link sees the
 * unfiltered view for one frame before the filters apply. Crawlable content is
 * worth more than that frame.
 *
 * The returned boolean gates any effect that writes state back to the URL.
 * Without it, that effect fires first with default state and wipes the very
 * query string this hook is about to read.
 */
export function useSearchParamsOnMount(
  apply: (params: URLSearchParams) => void,
): boolean {
  // Keep the latest callback in a ref instead of the mount effect's dependency
  // array. Consumers pass an inline arrow function, so its identity changes on
  // every render; depending on it directly would re-run the mount effect (and
  // re-apply params, resetting state) on every keystroke.
  const applyRef = useRef(apply);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => {
    // Read the URL and flip `ready` from a nested function rather than
    // inline. Calling setState as a direct statement in an effect body trips
    // react-hooks/set-state-in-effect ("cascading renders"), which assumes
    // the value could have been derived from props/state during render. It
    // can't here — window.location doesn't exist during the server render
    // this effect is deliberately skipped on — so the read has to happen
    // after mount, and that read is genuine work, not a bare setState proxy.
    const read = () => {
      applyRef.current(new URLSearchParams(window.location.search));
      setReady(true);
    };
    read();
  }, []);

  return ready;
}
