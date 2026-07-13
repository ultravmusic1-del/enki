"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Magic UI-style border beam — a light travels around a card's border. Used
 * sparingly on featured cards only, per the design plan. Rendered as a rotating
 * conic gradient revealed through a 1px border mask. Hidden under reduced motion.
 */
export function BorderBeam({
  duration = 7,
  color = "var(--brand-teal)",
  highlight = "var(--brand-teal-bright)",
}: {
  duration?: number;
  color?: string;
  highlight?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        padding: "1px",
        WebkitMask:
          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      <motion.div
        className="absolute inset-[-150%] rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg 300deg, ${color} 340deg, ${highlight} 355deg, ${color} 360deg)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
