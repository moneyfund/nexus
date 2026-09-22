"use client";

import { motion } from "motion/react";

export function NexusCore() {
  return (
    <div className="relative mx-auto h-[300px] w-[300px] [perspective:900px] sm:h-[360px] sm:w-[360px]">
      <div className="absolute inset-[13%] rounded-full bg-[#7c3aed]/20 blur-[55px]" />
      <motion.div
        animate={{ rotateZ: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[7%] rounded-full border border-[#a78bfa]/25 shadow-[0_0_55px_rgba(139,92,246,.13)]"
      >
        <span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,.9)]" />
      </motion.div>

      <motion.div
        animate={{ rotateZ: -360, rotateX: 64 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[18%] rounded-full border border-[#8b5cf6]/35"
      >
        <span className="absolute right-[10%] top-[8%] h-2 w-2 rounded-full bg-[#b794ff] shadow-[0_0_14px_rgba(167,139,250,.95)]" />
      </motion.div>

      <motion.div
        animate={{ rotateZ: 360, rotateY: 68 }}
        transition={{ duration: 19, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[22%] rounded-full border border-white/15"
      />

      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [.82, 1, .82] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-[31%] rounded-full border border-[#a78bfa]/40 bg-[radial-gradient(circle_at_38%_34%,rgba(255,255,255,.36),rgba(139,92,246,.28)_16%,rgba(42,16,75,.86)_45%,rgba(4,4,7,.96)_72%)] shadow-[0_0_65px_rgba(124,58,237,.32),inset_0_0_25px_rgba(255,255,255,.08)]"
      >
        <div className="absolute inset-[14%] rounded-full border border-white/8" />
        <div className="absolute left-[28%] top-[24%] h-[16%] w-[16%] rounded-full bg-white/75 blur-[2px]" />
      </motion.div>

      <div className="absolute left-1/2 top-1/2 h-[2px] w-[92%] -translate-x-1/2 -translate-y-1/2 rotate-[18deg] bg-gradient-to-r from-transparent via-[#8b5cf6]/35 to-transparent blur-[.2px]" />
      <div className="absolute left-1/2 top-1/2 h-[2px] w-[88%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  );
}
