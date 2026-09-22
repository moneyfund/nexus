"use client";

import { ArrowLeft, Check, Circle, Clock3, Play, Wallet } from "lucide-react";
import Link from "next/link";
import { useNexus } from "@/components/nexus-provider";

export function ProjectDetail({ id }: { id: string }) {
  const { projects, toggleTask, startFlow } = useNexus();
  const project = projects.find((item) => item.id === id);

  if (!project) return <div className="mx-auto max-w-5xl py-20 text-center text-[#7a859b]">Proyecto no encontrado.</div>;

  const pending = project.tasks.filter((task) => !task.completed);

  return (
    <div className="mx-auto max-w-[1350px]">
      <Link href="/projects" className="inline-flex items-center gap-2 text-xs text-[#737f97] hover:text-white"><ArrowLeft size={14} /> Projects</Link>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#69758c]">{project.area}</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7c879d]">{project.description}</p>
            </div>
            <div className="min-w-32 text-left md:text-right">
              <div className="text-4xl font-light tracking-[-.06em]">{project.progress}%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[.16em] text-[#5f6a80]">overall progress</div>
            </div>
          </div>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full rounded-full" style={{ width: project.progress + "%", background: "linear-gradient(90deg," + project.accent + ",#c0c6ff)" }} /></div>

          <div className="mt-8">
            <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#69758c]">Roadmap</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {project.milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-2xl border border-white/[.055] bg-white/[.022] p-4">
                  <div className="flex justify-between gap-4"><span className="text-sm font-medium">{milestone.title}</span><span className="text-xs text-[#788399]">{milestone.progress}%</span></div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/[.055]"><div className="h-full rounded-full" style={{ width: milestone.progress + "%", background: project.accent }} /></div>
                  <div className="mt-2 text-[9px] uppercase tracking-[.14em] text-[#4f596b]">Peso {milestone.weight}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[26px] border border-[#8b5cf6]/20 bg-gradient-to-br from-[#131a34] to-[#0b101d] p-5">
            <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#7280ff]/20 blur-[55px]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#7783a1]">Next action</div>
              <div className="mt-2 text-lg font-semibold leading-6">{project.nextAction}</div>
              {pending[0] && <button onClick={() => startFlow(project.id, pending[0].id)} className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#080b12]"><Play size={14} fill="currentColor" /> Iniciar Flow</button>}
            </div>
          </div>

          <div className="glass rounded-[26px] p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-soft rounded-2xl p-3.5"><Clock3 size={15} className="text-[#a78bfa]" /><div className="mt-3 text-xl font-light">{project.hours.toFixed(1)}h</div><div className="mt-1 text-[10px] text-[#657087]">Tiempo real</div></div>
              <div className="glass-soft rounded-2xl p-3.5"><Wallet size={15} className="text-[#a78bfa]" /><div className="mt-3 text-xl font-light">{project.value ? "$" + project.value : "—"}</div><div className="mt-1 text-[10px] text-[#657087]">Valor proyecto</div></div>
            </div>
            {project.value && <div className="mt-3 rounded-2xl border border-white/[.055] bg-white/[.022] p-3.5 text-xs text-[#808ba1]">Cobrado <span className="float-right font-medium text-white">{"$" + (project.paid ?? 0) + " / $" + project.value}</span></div>}
          </div>
        </div>
      </div>

      <div className="mt-4 glass rounded-[28px] p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Execution</div><h2 className="mt-1 text-lg font-semibold">Tasks</h2></div><span className="text-xs text-[#667187]">{project.tasks.filter((task) => task.completed).length}/{project.tasks.length}</span></div>
        <div className="mt-4 divide-y divide-white/[.055]">
          {project.tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 py-4">
              <button onClick={() => toggleTask(project.id, task.id)} className={"grid h-6 w-6 shrink-0 place-items-center rounded-full border " + (task.completed ? "border-[#a78bfa]/40 bg-[#a78bfa]/10 text-[#a78bfa]" : "border-white/15 text-[#59647a]")}>{task.completed ? <Check size={13} /> : <Circle size={10} />}</button>
              <div className="min-w-0 flex-1"><div className={"text-sm " + (task.completed ? "text-[#687388] line-through" : "text-[#d6dae4]")}>{task.title}</div><div className="mt-1 text-[10px] uppercase tracking-[.12em] text-[#525d70]">{task.milestone} · {task.estimatedMinutes} min</div></div>
              {!task.completed && <button onClick={() => startFlow(project.id, task.id)} className="rounded-xl border border-white/[.07] bg-white/[.025] p-2 text-[#778198] hover:text-white"><Play size={14} /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
