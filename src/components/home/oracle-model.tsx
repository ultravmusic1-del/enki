"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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

// If the scene throws *synchronously* while rendering, drop it and leave the
// poster in place. This cannot catch a failed WebGL context: R3F creates the
// renderer inside an un-awaited async run() in its own layout effect, so that
// failure surfaces as an unhandled rejection, never as a React error. See
// `webglAvailable` below, which stops us mounting the canvas in that case.
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
 * Whether this browser can actually give us a WebGL context.
 *
 * three throws `Error creating WebGL context.` from the WebGLRenderer
 * constructor when it cannot get one — on a blocklisted GPU driver, with
 * hardware acceleration switched off, or after the GPU process has died. R3F
 * awaits that constructor inside a promise it never catches, so the rejection
 * escapes every boundary and lands in Sentry as an unhandled error, roughly 900
 * times a month. Probing first and simply not mounting the canvas is the only
 * way to avoid it: there is no error hook on <Canvas> to use instead.
 *
 * Cached because the answer cannot change within a page life, and each probe
 * costs a real GL context.
 */
let webglSupport: boolean | null = null;

function webglAvailable(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === "undefined") return false;

  try {
    const probe = document.createElement("canvas");
    // The same attributes the real renderer asks for, so the probe fails in
    // the same conditions it would. three tries webgl2 before webgl.
    const attrs: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    };
    const gl =
      probe.getContext("webgl2", attrs) ?? probe.getContext("webgl", attrs);

    // Hand the context straight back. Browsers cap how many a page may hold at
    // once, and keeping this one would count against the renderer's own.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();

    webglSupport = gl !== null;
  } catch {
    // getContext itself can throw in hardened browsers.
    webglSupport = false;
  }

  return webglSupport;
}

// Support cannot change within a page life, so there is genuinely nothing to
// subscribe to — but useSyncExternalStore is still the right tool: it is what
// reads a client-only value without tripping hydration.
const subscribeToNothing = () => () => {};

/**
 * Hero 3D model. Pauses its render loop when scrolled out of view so it never
 * costs frames while the rest of the page is on screen.
 */
export function OracleModel() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  // Read through useSyncExternalStore rather than probed during render: the
  // server has no document and would resolve `false`, so deciding this in the
  // render body would mismatch on hydration. React takes the server snapshot
  // while hydrating and the real one immediately after, which is the same
  // one-tick delay the ssr:false dynamic import above already has.
  const webgl = useSyncExternalStore(
    subscribeToNothing,
    webglAvailable,
    () => false,
  );

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
      {webgl && (
        <WebGLBoundary>
          <OracleModelScene active={active} onReady={handleReady} />
        </WebGLBoundary>
      )}
    </div>
  );
}
