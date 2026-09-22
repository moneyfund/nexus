"use client";

import { motion, useScroll, useTransform } from "motion/react";

export function AmbientScene() {
  const { scrollYProgress } = useScroll();
  const gridY = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const orbRotate = useTransform(scrollYProgress, [0, 1], [0, 42]);
  const hazeY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#030306]">
      <motion.div
        style={{ y: hazeY }}
        className="absolute left-[8%] top-[-18%] h-[620px] w-[620px] rounded-full bg-[#e33bd8]/12 blur-[150px]"
      />
      <motion.div
        style={{ y: orbY, rotate: orbRotate }}
        className="absolute right-[-12%] top-[7%] h-[520px] w-[520px] rounded-full border border-[#f472d0]/10"
      >
        <div className="absolute inset-[12%] rounded-full border border-[#e33bd8]/10" />
        <div className="absolute inset-[27%] rounded-full bg-[#a855f7]/10 blur-3xl" />
      </motion.div>
      <div className="absolute left-[18%] top-[34%] h-[320px] w-[320px] rounded-full bg-[#86198f]/10 blur-[140px]" />
      <motion.div style={{ y: gridY }} className="absolute inset-x-[-20%] top-[18%] h-[120vh] opacity-60">
        <div className="nexus-perspective-grid h-full w-full" />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,3,6,.16)_45%,#030306_86%)]" />
      <div className="noise-layer absolute inset-0 opacity-[.16]" />
    </div>
  );
}
