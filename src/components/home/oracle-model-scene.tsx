"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/enki-model.glb";

// Meshopt-compressed, no Draco — disable the Draco loader path entirely.
useGLTF.preload(MODEL_URL, false, true);

type PointerState = {
  x: number;
  y: number;
  /** Accumulated impulse from recent movement (flick kicks); decays each frame. */
  vx: number;
  vy: number;
  /** Engagement 0..1 — rises with movement, decays toward calm. */
  energy: number;
};

function OracleTablet({
  active,
  reduce,
}: {
  active: boolean;
  reduce: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL, false, true);
  const group = useRef<THREE.Group>(null);
  const rimLight = useRef<THREE.PointLight>(null);
  const pointer = useRef<PointerState>({ x: 0, y: 0, vx: 0, vy: 0, energy: 0 });
  const { invalidate, viewport } = useThree();
  const lift = useRef(0);
  // Spring velocities for each animated channel.
  const vel = useRef({ rx: 0, ry: 0, rz: 0, px: 0, py: 0 });

  // The teal relief material — a ref so the frame loop can pulse its emissive
  // intensity imperatively as the oracle "awakens" to the cursor.
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  if (materialRef.current === null) {
    materialRef.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0d7f86"),
      metalness: 0.28,
      roughness: 0.55,
      emissive: new THREE.Color("#00adb5"),
      emissiveIntensity: 0.16,
    });
  }

  // Track pointer position, movement impulse, and engagement energy.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      const s = pointer.current;
      const dx = nx - s.x;
      const dy = ny - s.y;
      s.vx += dx;
      s.vy += dy;
      s.energy = Math.min(1, s.energy + Math.hypot(dx, dy) * 3.5);
      s.x = nx;
      s.y = ny;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Clone the loaded scene and normalize it to unit height centered at the
  // origin. Group scale then fits it responsively (see below).
  const { model, aspect } = useMemo(() => {
    const root = scene.clone(true);

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    root.position.sub(center);
    root.scale.setScalar(1 / (size.y || 1)); // normalize to unit height

    return { model: root, aspect: (size.x || 1) / (size.y || 1) };
  }, [scene]);

  // Apply the teal material to every mesh once the model is ready (kept out of
  // the memo so the ref is never read during render).
  useLayoutEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.material = mat;
    });
  }, [model]);

  // Fit the model to the viewport so it frames consistently across screen sizes
  // (portrait phones would otherwise crop the face). Lift it so the detailed
  // face sits behind the bold headline, not the body copy.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    const maxHeight = viewport.height * 0.72;
    const maxWidth = viewport.width * 0.78;
    const height = Math.min(maxHeight, maxWidth / aspect);
    g.scale.setScalar(height);
    // Small downward bias so the crown clears the fixed header.
    lift.current = -height * 0.04;
    if (reduce) {
      g.position.set(0, lift.current, 0);
      g.rotation.set(0, 0, 0);
      invalidate();
    }
  }, [viewport.width, viewport.height, aspect, reduce, invalidate]);

  // Drive rendering ourselves in "demand" mode: a rAF loop of invalidate()
  // while the hero is on screen, stopped when it scrolls away. This avoids
  // R3F's frameloop never->always restart bug (which left the canvas blank
  // after scrolling back) and re-renders on return so the model reappears.
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      invalidate();
      return;
    }
    let raf = 0;
    const loop = () => {
      invalidate();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce, invalidate]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || reduce) return;
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const p = pointer.current;
    const v = vel.current;

    // Engagement decays toward calm; its inverse drives the idle drift.
    p.energy *= Math.exp(-2.4 * dt);
    const idle = 1 - p.energy;

    // Autonomous idle drift + float, so the oracle is never dead-static.
    const swayY = Math.sin(t * 0.45) * 0.13 * idle + Math.sin(t * 0.11) * 0.04;
    const swayX = Math.cos(t * 0.33) * 0.06 * idle;
    const floatY = Math.sin(t * 0.6) * 0.05;

    // Targets — the oracle turns to face the cursor, drifts + banks slightly.
    const targetRotY = p.x * 0.6 + swayY;
    const targetRotX = p.y * 0.32 + swayX;
    const targetRotZ = -p.x * 0.06;
    const targetPosX = p.x * 0.2;
    const targetPosY = lift.current + floatY - p.y * 0.1;

    // Transient flick kicks — a quick mouse move shoves the springs.
    v.ry += p.vx * 2.1;
    v.rx += p.vy * 1.3;
    v.rz += -p.vx * 0.9;
    p.vx *= Math.exp(-11 * dt);
    p.vy *= Math.exp(-11 * dt);

    // Underdamped springs → lively motion with a touch of overshoot & settle.
    const spring = (
      cur: number,
      key: keyof typeof v,
      target: number,
      k: number,
      d: number,
    ) => {
      v[key] += (k * (target - cur) - d * v[key]) * dt;
      return cur + v[key] * dt;
    };
    g.rotation.y = spring(g.rotation.y, "ry", targetRotY, 44, 8.5);
    g.rotation.x = spring(g.rotation.x, "rx", targetRotX, 44, 8.5);
    g.rotation.z = spring(g.rotation.z, "rz", targetRotZ, 34, 8);
    g.position.x = spring(g.position.x, "px", targetPosX, 40, 10);
    g.position.y = spring(g.position.y, "py", targetPosY, 55, 12);

    // Never let it turn edge-on; bleed off velocity when clamped so it doesn't buzz.
    if (g.rotation.y > 0.85) {
      g.rotation.y = 0.85;
      v.ry = Math.min(v.ry, 0);
    } else if (g.rotation.y < -0.85) {
      g.rotation.y = -0.85;
      v.ry = Math.max(v.ry, 0);
    }
    if (g.rotation.x > 0.6) {
      g.rotation.x = 0.6;
      v.rx = Math.min(v.rx, 0);
    } else if (g.rotation.x < -0.6) {
      g.rotation.x = -0.6;
      v.rx = Math.max(v.rx, 0);
    }

    // "Awaken" — the relief glows brighter as you engage.
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.16 + p.energy * 0.24;
    }

    // A teal specular highlight that sweeps across the relief with the cursor.
    const rim = rimLight.current;
    if (rim) {
      rim.position.x += (p.x * 3.4 - rim.position.x) * 0.12;
      rim.position.y += (1 - p.y * 2.6 - rim.position.y) * 0.12;
      rim.intensity = 11 + p.energy * 16;
    }
  });

  return (
    <>
      <pointLight
        ref={rimLight}
        position={[0, 1, 4]}
        intensity={11}
        distance={16}
        color="#35e4ec"
      />
      <group ref={group}>
        <primitive object={model} />
      </group>
    </>
  );
}

export function OracleModelScene({ active }: { active: boolean }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 34 }}
      style={{ pointerEvents: "none" }}
    >
      {/* Key + teal fill — moody so the relief reads as a backdrop. The moving
          rim/point light lives in OracleTablet and tracks the cursor. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 6]} intensity={1.5} color="#eafdff" />
      <directionalLight position={[-5, -1, 3]} intensity={0.5} color="#35e4ec" />
      <Suspense fallback={null}>
        <OracleTablet active={active} reduce={reduce} />
      </Suspense>
    </Canvas>
  );
}
