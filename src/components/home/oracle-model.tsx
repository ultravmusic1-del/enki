"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/utils";

// The 3D scene (Three.js + R3F) is heavy, so it is code-split and loaded only
// on the client. The poster below stands in until it can draw.
const OracleModelScene = dynamic(
  () => import("./oracle-model-scene").then((m) => m.OracleModelScene),
  { ssr: false },
);

/**
 * Stand-in until WebGL has the model on screen.
 *
 * This is a render of the model itself, captured by `pnpm poster` from the
 * canonical reduced-motion pose, so the handover is a dissolve between two
 * near-identical images.
 *
 * It replaces the flat emblem mask, which was the wrong image in two ways: it
 * read as a 2D logo appearing where a 3D relief belongs, and at 415KB it did not
 * finish downloading until 9.6s on a throttled cold load — so the hero showed
 * nothing at all before that, then a logo, and only then the oracle.
 *
 * `priority` emits a preload so it is fetched with the first wave of resources
 * rather than when React gets around to mounting this. `unoptimized` because
 * the asset is already a size-capped WebP; re-encoding it through the image
 * optimiser would only add a round trip.
 */
function OraclePoster({ hidden }: { hidden: boolean }) {
  return (
    <Image
      src="/brand/oracle-poster.webp"
      alt=""
      aria-hidden
      fill
      priority
      unoptimized
      sizes="100vw"
      className={cn(
        "pointer-events-none object-contain transition-opacity duration-700 ease-out",
        hidden ? "opacity-0" : "opacity-100",
      )}
    />
  );
}

// If WebGL is unavailable or the scene throws at runtime, render nothing and
// leave the poster in place — it is a faithful still of what would have drawn.
class WebGLBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Hero 3D model. Pauses its render loop when scrolled out of view so it never
 * costs frames while the rest of the page is on screen.
 */
export function OracleModel() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);

  const handleReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // `relative` anchors the fill-positioned poster. The canvas comes later in
    // the tree and is itself positioned, so it paints above the poster and the
    // crossfade never leaves a gap with neither visible.
    <div ref={ref} className="relative h-full w-full">
      <OraclePoster hidden={ready} />
      <WebGLBoundary>
        <OracleModelScene active={active} onReady={handleReady} />
      </WebGLBoundary>
    </div>
  );
}
