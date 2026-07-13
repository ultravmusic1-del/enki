"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

// Avoid the SSR useLayoutEffect warning while keeping layout-phase timing on
// the client (prevents a flash of the pre-animation state).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Minimal `useGSAP`-style hook (we don't pull in @gsap/react). Runs the
 * callback inside a scoped `gsap.context` so selector strings resolve within
 * the scope element, and reverts every animation/cleanup on unmount.
 *
 * The callback may return a cleanup function (e.g. to remove listeners).
 */
export function useGSAP(
  callback: (context: gsap.Context) => void | (() => void),
  { scope }: { scope: RefObject<HTMLElement | null> },
) {
  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(callback, scope.current ?? undefined);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
