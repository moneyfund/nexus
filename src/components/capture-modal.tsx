"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, Lightbulb, ListTodo, NotebookPen, X } from "lucide-react";
import { useNexus } from "@/components/nexus-provider";
import type { InboxItem } from "@/lib/types";

const options: { type: InboxItem["type"]; label: string; icon: typeof Lightbulb }[] = [
  { type: "idea", label: "Idea", icon: Lightbulb },
  { type: "task", label: "Tarea", icon: ListTodo },
  { type: "note", label: "Nota", icon: NotebookPen },
  { type: "income", label: "Ingreso", icon: ArrowDownLeft },
  { type: "expense", label: "Gasto", icon: ArrowUpRight }
];

export function CaptureModal() {
  const { captureOpen, setCaptureOpen, capture } = useNexus();
  const [type, setType] = useState<InboxItem["type"]>("idea");
  const [content, setContent] = useState("");

  function submit() {
    capture(type, content);
    setContent("");
  }

  return (
    <AnimatePresence>
      {captureOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && setCaptureOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: .98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: .98 }}
            className="glass purple-glow relative w-full max-w-2xl overflow-hidden rounded-[32px] p-5 sm:p-7"
          >
            <div className="absolute inset-x-0 top-0 h-px neon-line opacity-70" /><div className="absolute right-[-90px] top-[-90px] h-56 w-56 rounded-full bg-[#7c3aed]/15 blur-[70px]" /><div className="relative flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.22em] text-[#8b96ad]">Universal inbox</div>
                <h2 className="mt-2 text-2xl font-semibold">Captura sin romper el flujo.</h2>
                <p className="mt-2 text-sm text-[#8b96ad]">Guárdalo ahora. Decide qué hacer con ello durante la revisión.</p>
              </div>
              <button onClick={() => setCaptureOpen(false)} className="rounded-full border border-white/10 p-2 text-[#8b96ad] hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2">
              {options.map((option) => {
                const Icon = option.icon;
                const active = type === option.type;
                return (
                  <button
                    key={option.type}
                    onClick={() => setType(option.type)}
                    className={"flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-xs transition " + (active ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-white" : "border-white/7 bg-white/[.025] text-[#8b96ad] hover:bg-white/[.05]")}
                  >
                    <Icon size={18} />{option.label}
                  </button>
                );
              })}
            </div>

            <textarea
              autoFocus
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
              }}
              placeholder={type === "idea" ? "¿Qué se te acaba de ocurrir?" : "Escribe aquí..."}
              className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-white/8 bg-black/20 p-4 text-[15px] leading-7 text-white outline-none placeholder:text-[#596276] focus:border-[#8b5cf6]/55"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-[#657087]">Ctrl/⌘ + Enter para guardar</span>
              <button onClick={submit} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#090c13] transition hover:scale-[1.02]">Guardar en Inbox</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
