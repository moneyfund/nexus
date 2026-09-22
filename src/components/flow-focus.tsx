"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pause, Sparkles, X } from "lucide-react";
import { useNexus } from "@/components/nexus-provider";

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function FlowFocus() {
  const { activeFlow, endFlow, setCaptureOpen } = useNexus();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeFlow) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeFlow]);

  const remaining = useMemo(() => {
    if (!activeFlow) return 0;
    return activeFlow.durationMinutes * 60 - Math.floor((now - activeFlow.startedAt) / 1000);
  }, [activeFlow, now]);

  return (
    <AnimatePresence>
      {activeFlow && (
        <motion.div className="fixed inset-0 z-[70] overflow-hidden bg-[#05070c]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="nexus-grid absolute inset-0 opacity-70" />
          <div className="absolute left-1/2 top-[-180px] h-[430px] w-[430px] -translate-x-1/2 rounded-full bg-[#6878ff]/20 blur-[110px]" />
          <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6 sm:px-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.25em] text-[#758097]">
                <span className="pulse-dot h-2 w-2 rounded-full bg-[#4ee3a1]" /> Nexus Flow
              </div>
              <button onClick={() => endFlow(false)} className="rounded-full border border-white/10 p-2 text-[#7d879a] hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
              <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-3xl">
                <div className="text-sm font-medium text-[#7783ff]">{activeFlow.projectName}</div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-.03em] sm:text-5xl">{activeFlow.title}</h2>
                <div className="mt-10 font-mono text-5xl font-light tracking-[-.05em] text-gradient sm:text-7xl">{formatTime(remaining)}</div>
                <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#778198]">Una tarea. Un resultado. Cualquier idea nueva va al Inbox; no cambia la prioridad actual.</p>
                <div className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                  <button onClick={() => setCaptureOpen(true)} className="glass-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm text-[#c4cbea]"><Sparkles size={16} /> Capturar idea</button>
                  <button className="glass-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm text-[#c4cbea]"><Pause size={16} /> Pausar</button>
                  <button onClick={() => endFlow(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#090c13]"><Check size={16} /> Terminar</button>
                </div>
              </motion.div>
            </div>
            <div className="flex justify-between border-t border-white/7 pt-5 text-xs text-[#5f6879]"><span>Sesión protegida</span><span>{activeFlow.durationMinutes} min planificados</span></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
