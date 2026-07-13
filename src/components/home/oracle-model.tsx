"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

// The 3D scene (Three.js + R3F) is heavy, so it is code-split and loaded only
// on the client. Until it is ready, the static emblem stands in — no layout
// shift, and a graceful fallback if WebGL/JS is unavailable.
const OracleModelScene = dynamic(
  () => import("./oracle-model-scene").then((m) => m.OracleModelScene),
  { ssr: false, loading: () => <EmblemFallback /> },
);

function EmblemFallback() {
  return (
    <div className="grid h-full place-items-center">
      <span
        className="emblem size-40 animate-pulse sm:size-52"
        style={{
          color: "var(--brand-teal)",
          filter: "drop-shadow(0 0 40px rgb(var(--glow) / 0.55))",
        }}
        aria-hidden
      />
    </div>
  );
}

// If WebGL is unavailable or the scene throws at runtime, fall back to the
// static emblem rather than breaking the hero.
class WebGLBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <EmblemFallback /> : this.props.children;
  }
}

/**
 * Hero 3D model. Pauses its render loop when scrolled out of view so it never
 * costs frames while the rest of the page is on screen.
 */
export function OracleModel() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

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
    <div ref={ref} className="h-full w-full">
      <WebGLBoundary>
        <OracleModelScene active={active} />
      </WebGLBoundary>
    </div>
  );
}
