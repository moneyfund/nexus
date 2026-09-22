"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight, BrainCircuit, CheckCircle2, Circle, Clock3,
  Flame, Play, TrendingUp, Wallet
} from "lucide-react";
import { todayBlocks } from "@/lib/mock-data";
import { useNexus } from "@/components/nexus-provider";
import { ProjectCard } from "@/components/project-card";

export function Dashboard() {
  const { projects, inbox, startFlow } = useNexus();
  const active = projects.filter((project) => project.status === "active");
  const criscasa = projects.find((project) => project.id === "criscasa") ?? active[0];
  const primaryTask = criscasa?.tasks.find((task) => !task.completed);
  const dateLabel = new Intl.DateTimeFormat("es-NI", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const metrics = [
    { label: "Focus score", value: "84", suffix: "/100", meta: "+7 esta semana", icon: Flame },
    { label: "Deep work", value: "3h 20", suffix: "", meta: "4h 30 planificadas", icon: Clock3 },
    { label: "Active projects", value: String(active.length), suffix: "/5", meta: "Límite WIP alcanzado", icon: TrendingUp },
    { label: "Por cobrar", value: "$720", suffix: "", meta: "3 proyectos", icon: Wallet }
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div suppressHydrationWarning className="text-xs font-semibold uppercase tracking-[.2em] text-[#657087]">{dateLabel}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Buenos días, <span className="text-gradient">Norvin.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758097]">Tu sistema está enfocado. Cinco proyectos pueden consumir tiempo; todo lo demás espera.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[#4ee3a1]/15 bg-[#4ee3a1]/[.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#7aefb7]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#4ee3a1]" /> Execution mode
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div key={metric.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} className="glass rounded-[22px] p-4">
              <div className="flex items-center justify-between text-[#677287]">
                <span className="text-[10px] font-semibold uppercase tracking-[.16em]">{metric.label}</span>
                <Icon size={15} />
              </div>
              <div className="mt-4 flex items-end gap-1.5"><span className="text-3xl font-light tracking-[-.05em]">{metric.value}</span><span className="mb-1 text-xs text-[#667187]">{metric.suffix}</span></div>
              <div className="mt-2 text-[11px] text-[#697489]">{metric.meta}</div>
            </motion.div>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 2xl:grid-cols-[1.55fr_.85fr]">
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }} className="relative overflow-hidden rounded-[30px] border border-[#7180ff]/20 bg-[linear-gradient(125deg,#11172d_0%,#0c1224_42%,#0b101b_100%)] p-6 sm:p-8">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#6272ff]/20 blur-[80px]" />
            <div className="absolute bottom-[-100px] left-[35%] h-56 w-56 rounded-full bg-[#2cd4ff]/10 blur-[85px]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#7d89a8]"><span className="h-1.5 w-1.5 rounded-full bg-[#6f7cff]" /> Ahora</div>
              <div className="mt-5 max-w-3xl">
                <div className="text-sm font-medium text-[#8d98ff]">{criscasa?.name}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] sm:text-4xl">{primaryTask?.title ?? criscasa?.nextAction}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#7e89a1]">Resultado esperado: dejar resuelto el bloque estructural antes de cambiar de contexto.</p>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => primaryTask && criscasa && startFlow(criscasa.id, primaryTask.id)}
                  className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#080b12] shadow-[0_8px_30px_rgba(255,255,255,.08)] transition hover:scale-[1.02]"
                >
                  <Play size={16} fill="currentColor" /> Iniciar Flow
                </button>
                <span className="rounded-xl border border-white/[.07] bg-white/[.035] px-4 py-3 text-xs text-[#98a3ba]">90 min · Critical</span>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <div className="glass rounded-[26px] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Resultados del día</div><h3 className="mt-1.5 text-lg font-semibold">Las 3 cosas que sí importan</h3></div>
                <span className="text-xs text-[#657087]">0 / 3</span>
              </div>
              <div className="mt-5 space-y-2">
                {[
                  ["CRISCASA", "Cerrar correcciones estructurales"],
                  ["Tesis Civil", "Avanzar metodología"],
                  ["Pequeños Escritores", "Resolver scoring de trazos"]
                ].map(([project, task], index) => (
                  <div key={task} className="flex items-center gap-3 rounded-2xl border border-white/[.055] bg-white/[.022] p-3.5">
                    <Circle size={17} className="shrink-0 text-[#5f6a81]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#69758e]">{project}</div>
                      <div className="mt-1 truncate text-sm text-[#d8dce5]">{task}</div>
                    </div>
                    <span className="text-xs text-[#4f596d]">0{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-[26px] p-5 sm:p-6">
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Agenda</div>
              <h3 className="mt-1.5 text-lg font-semibold">Bloques protegidos</h3>
              <div className="mt-5 space-y-4">
                {todayBlocks.map((block) => {
                  const project = projects.find((item) => item.id === block.projectId);
                  return (
                    <div key={block.time} className="grid grid-cols-[48px_1fr] gap-3">
                      <div className="pt-0.5 text-xs font-medium text-[#6f7a90]">{block.time}</div>
                      <div className="relative border-l border-white/[.08] pl-4">
                        <span className="absolute -left-[4px] top-1.5 h-[7px] w-[7px] rounded-full" style={{ background: project?.accent ?? "#6d7cff" }} />
                        <div className="text-xs font-medium text-[#8994aa]">{project?.name}</div>
                        <div className="mt-1 text-sm text-[#d4d8e2]">{block.title}</div>
                        <div className="mt-1 text-[10px] text-[#59647a]">{block.time} — {block.end}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Nexus signal</div><h3 className="mt-1.5 text-lg font-semibold">Estado operativo</h3></div>
              <BrainCircuit size={19} className="text-[#818cff]" />
            </div>
            <div className="mt-5 rounded-2xl border border-[#7783ff]/15 bg-[#7783ff]/[.055] p-4">
              <p className="text-sm leading-6 text-[#b7bfd0]">CRISCASA concentra el riesgo inmediato. La tesis necesita un bloque largo después de cerrar la corrección estructural.</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-[#7f8aff]"><CheckCircle2 size={13} /> Basado en prioridades actuales</div>
            </div>
          </div>

          <div className="glass rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Inbox</div><h3 className="mt-1.5 text-lg font-semibold">Capturado, no prioritario</h3></div>
              <span className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] text-[#768198]">{inbox.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {inbox.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/[.055] bg-white/[.022] p-3.5">
                  <div className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#69758c]">{item.type}</div>
                  <div className="mt-1.5 text-sm leading-5 text-[#c7ccd8]">{item.content}</div>
                </div>
              ))}
            </div>
            <Link href="/ideas" className="mt-4 flex items-center gap-2 text-xs font-medium text-[#8c97ff]">Revisar inbox <ArrowRight size={13} /></Link>
          </div>

          <div className="glass overflow-hidden rounded-[26px] p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">Today completion</div><div className="mt-2 text-3xl font-light tracking-[-.04em]">56%</div></div>
              <span className="text-xs text-[#667187]">2h 34 / 4h 30</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full w-[56%] rounded-full bg-gradient-to-r from-[#6f7cff] to-[#32d3ff]" /></div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#606b81]">WIP · 5/5</div><h2 className="mt-1.5 text-xl font-semibold">Proyectos activos</h2></div>
          <Link href="/projects" className="flex items-center gap-2 text-xs font-medium text-[#8c97ff]">Ver todos <ArrowRight size={13} /></Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {active.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </section>
    </div>
  );
}
