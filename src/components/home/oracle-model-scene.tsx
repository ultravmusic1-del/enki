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

/** Shared pointer state (window-space, -1..1), read inside the frame loop. */
function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return pointer;
}

function OracleTablet({
  active,
  reduce,
}: {
  active: boolean;
  reduce: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL, false, true);
  const group = useRef<THREE.Group>(null);
  const pointer = usePointer();
  const { invalidate, viewport } = useThree();
  const lift = useRef(0);

  // Clone the loaded scene, retint every mesh with a brand-teal material, and
  // normalize it to unit height centered at the origin. Group scale then fits
  // it responsively to the viewport (see below).
  const { model, aspect } = useMemo(() => {
    const root = scene.clone(true);

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0d7f86"),
      metalness: 0.28,
      roughness: 0.55,
      emissive: new THREE.Color("#00adb5"),
      emissiveIntensity: 0.16,
    });

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = material;
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

  useFrame((state) => {
    const g = group.current;
    if (!g || reduce) return;
    const t = state.clock.elapsedTime;

    // Gentle float around the lifted base position.
    g.position.y = lift.current + Math.sin(t * 0.6) * 0.05;

    // Oscillating yaw (never turns edge-on) + pointer parallax.
    const targetY = Math.sin(t * 0.22) * 0.45 + pointer.current.x * 0.32;
    const targetX = -0.04 + pointer.current.y * 0.18;
    g.rotation.y += (targetY - g.rotation.y) * 0.045;
    g.rotation.x += (targetX - g.rotation.x) * 0.045;
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
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
      {/* Key + teal fill + rim — moody so the relief reads as a backdrop */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 6]} intensity={1.5} color="#eafdff" />
      <directionalLight position={[-5, -1, 3]} intensity={0.5} color="#35e4ec" />
      <pointLight
        position={[0, 1.2, 4]}
        intensity={13}
        distance={14}
        color="#00c2cb"
      />
      <Suspense fallback={null}>
        <OracleTablet active={active} reduce={reduce} />
      </Suspense>
    </Canvas>
  );
}
