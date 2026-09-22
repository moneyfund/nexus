"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MouseEvent, ReactNode } from "react";

export function DepthCard({
  children,
  className = "",
  intensity = 7,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), {
    stiffness: 180,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), {
    stiffness: 180,
    damping: 20,
  });
  const sheenX = useTransform(px, [0, 1], ["-30%", "130%"]);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }

  function reset() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
        transformStyle: "preserve-3d",
      }}
      className={"depth-card relative " + className}
    >
      <motion.div
        aria-hidden
        style={{ x: sheenX }}
        className="pointer-events-none absolute inset-y-0 z-20 w-24 rotate-12 bg-gradient-to-r from-transparent via-white/[.045] to-transparent blur-xl"
      />
      <div className="relative z-10 [transform:translateZ(24px)]">
        {children}
      </div>
    </motion.div>
  );
}
