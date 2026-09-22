"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, BrainCircuit, CheckCircle2, Circle, Clock3,
  Flame, Play, ScanLine, TrendingUp, Wallet
} from "lucide-react";
import { todayBlocks } from "@/lib/mock-data";
import { useNexus } from "@/components/nexus-provider";
import { ProjectCard } from "@/components/project-card";
import { DepthCard } from "@/components/depth-card";
import { NexusCore } from "@/components/nexus-core";

const reveal = {
  hidden: { opacity: 0, y: 34 },
  visible: { opacity: 1, y: 0 }
};

export function Dashboard() {
  const { projects, inbox, startFlow } = useNexus();
  const active = projects.filter((project) => project.status === "active");
  const criscasa = projects.find((project) => project.id === "criscasa") ?? active[0];
  const primaryTask = criscasa?.tasks.find((task) => !task.completed);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const heroRotate = useTransform(scrollYProgress, [0, 1], [0, -5]);
  const heroOpacity = useTransform(scrollYProgress, [0, .9], [1, .4]);
  const dateLabel = new Intl.DateTimeFormat("es-NI", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const metrics = [
    { label: "Focus score", value: "84", suffix: "/100", meta: "+7 esta semana", icon: Flame },
    { label: "Deep work", value: "3h 20", suffix: "", meta: "4h 30 planificadas", icon: Clock3 },
    { label: "Active projects", value: String(active.length), suffix: "/5", meta: "Límite WIP alcanzado", icon: TrendingUp },
    { label: "Por cobrar", value: "$720", suffix: "", meta: "3 proyectos", icon: Wallet }
  ];

  return (
    <div className="mx-auto max-w-[1540px]">
      <motion.div
        ref={heroRef}
        style={{ y: heroY, rotateX: heroRotate, opacity: heroOpacity, transformPerspective: 1200 }}
        className="relative isolate min-h-[610px] overflow-hidden rounded-[34px] border border-white/[.075] bg-[linear-gradient(145deg,rgba(10,8,16,.94),rgba(3,3,6,.92)_62%,rgba(15,7,28,.92))] shadow-[0_42px_110px_rgba(0,0,0,.58)]"
      >
        <div className="absolute inset-0 opacity-60">
          <div className="nexus-grid absolute inset-0 [mask-image:radial-gradient(circle_at_60%_45%,black,transparent_72%)]" />
          <div className="absolute right-[-8%] top-[-18%] h-[480px] w-[480px] rounded-full bg-[#7c3aed]/14 blur-[120px]" />
          <div className="absolute bottom-[-38%] left-[18%] h-[420px] w-[420px] rounded-full bg-[#4c1d95]/12 blur-[120px]" />
        </div>

        <div className="absolute left-0 top-0 h-px w-full neon-line opacity-70" />
        <div className="relative grid min-h-[610px] gap-8 p-6 sm:p-9 lg:grid-cols-[1.05fr_.95fr] lg:p-12">
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/[.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-[#c3adff]">
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
                  Execution system online
                </span>
                <span suppressHydrationWarning className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#6f687a]">{dateLabel}</span>
              </div>

              <motion.div
                variants={reveal}
                initial="hidden"
                animate="visible"
                transition={{ duration: .72, ease: [0.22, 1, 0.36, 1] }}
                className="mt-12 max-w-3xl"
              >
                <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#776a8b]">
                  <ScanLine size={14} className="text-[#9f7aea]" /> Current directive
                </div>
                <h1 className="text-4xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl xl:text-7xl">
                  Menos ruido.<br />
                  <span className="text-gradient">Más ejecución.</span>
                </h1>
                <p className="mt-6 max-w-xl text-sm leading-7 text-[#8d8698] sm:text-[15px]">
                  NEXUS comprime todas tus prioridades en una sola orden operativa: terminar lo que importa antes de abrir otro frente.
                </p>
              </motion.div>
            </div>

            <div className="mt-10 max-w-3xl rounded-[24px] border border-white/[.07] bg-black/30 p-4 backdrop-blur-xl sm:p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#71697e]">Ahora · {criscasa?.name}</div>
                  <div className="mt-2 truncate text-lg font-semibold text-white sm:text-xl">{primaryTask?.title ?? criscasa?.nextAction}</div>
                  <div className="mt-1 text-xs text-[#7e7689]">90 min · Critical · Resultado protegido</div>
                </div>
                <button
                  onClick={() => primaryTask && criscasa && startFlow(criscasa.id, primaryTask.id)}
                  className="group flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_0_32px_rgba(255,255,255,.08)] transition hover:scale-[1.025]"
                >
                  <Play size={15} fill="currentColor" className="transition group-hover:translate-x-0.5" /> Iniciar Flow
                </button>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: .88, rotate: -7 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.05, delay: .12, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute h-[70%] w-[70%] rounded-full bg-[#6d28d9]/10 blur-[90px]" />
            <NexusCore />
            <div className="absolute bottom-[13%] left-1/2 w-[76%] -translate-x-1/2 rounded-2xl border border-white/[.065] bg-black/45 px-4 py-3 backdrop-blur-xl sm:w-[68%]">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[.17em] text-[#756d80]">
                <span>Nexus signal</span><BrainCircuit size={14} className="text-[#aa8cff]" />
              </div>
              <div className="mt-2 text-xs leading-5 text-[#b9b2c1]">
                5 proyectos activos. CRISCASA concentra el mayor riesgo inmediato.
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.section
        variants={reveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: .2 }}
        transition={{ duration: .65 }}
        className="relative z-10 -mt-8 grid gap-3 px-2 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <DepthCard key={metric.label} intensity={5} className="glass rounded-[24px] p-5">
              <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}>
                <div className="flex items-center justify-between text-[#746c80]">
                  <span className="text-[10px] font-semibold uppercase tracking-[.17em]">{metric.label}</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-[#8b5cf6]/15 bg-[#8b5cf6]/[.06]"><Icon size={14} className="text-[#a98cff]" /></div>
                </div>
                <div className="mt-6 flex items-end gap-1.5">
                  <span className="text-3xl font-light tracking-[-.055em] text-white">{metric.value}</span>
                  <span className="mb-1 text-xs text-[#746c80]">{metric.suffix}</span>
                </div>
                <div className="mt-2 text-[11px] text-[#756d80]">{metric.meta}</div>
              </motion.div>
            </DepthCard>
          );
        })}
      </motion.section>

      <motion.section
        variants={reveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: .18 }}
        transition={{ duration: .72 }}
        className="mt-16 grid gap-5 2xl:grid-cols-[1.08fr_.92fr]"
      >
        <div className="glass rounded-[30px] p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#756c81]">Priority stack</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Las 3 cosas que sí importan</h2>
            </div>
            <span className="rounded-full border border-white/[.06] bg-white/[.025] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#716979]">0 / 3 complete</span>
          </div>

          <div className="mt-7 space-y-3">
            {[
              ["CRISCASA", "Cerrar correcciones estructurales", "01"],
              ["Tesis Civil", "Avanzar metodología", "02"],
              ["Pequeños Escritores", "Resolver scoring de trazos", "03"]
            ].map(([project, task, number], index) => (
              <motion.div
                key={task}
                initial={{ opacity: 0, x: -26 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * .09, duration: .55 }}
                className="group relative overflow-hidden rounded-[22px] border border-white/[.06] bg-white/[.018] p-4 transition hover:border-[#8b5cf6]/25 hover:bg-[#8b5cf6]/[.035]"
              >
                <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-[#8b5cf6]/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center gap-4">
                  <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[.1] text-[#625a6d] transition group-hover:border-[#8b5cf6]/35 group-hover:text-[#a78bfa]"><Circle size={13} /></button>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#756d81]">{project}</div>
                    <div className="mt-1 text-sm text-[#ddd8e2]">{task}</div>
                  </div>
                  <span className="font-mono text-xs text-[#554e5e]">{number}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-[#8b5cf6]/16 bg-[linear-gradient(145deg,rgba(16,10,27,.88),rgba(5,5,8,.92))] p-5 shadow-[0_30px_90px_rgba(0,0,0,.4)] sm:p-7">
          <div className="absolute right-[-16%] top-[-30%] h-72 w-72 rounded-full bg-[#7c3aed]/14 blur-[85px]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#756c81]">Time architecture</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Bloques protegidos</h2>
              </div>
              <Clock3 size={18} className="text-[#a98cff]" />
            </div>

            <div className="mt-8 space-y-0">
              {todayBlocks.map((block, index) => {
                const project = projects.find((item) => item.id === block.projectId);
                return (
                  <motion.div
                    key={block.time}
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * .08 }}
                    className="grid grid-cols-[58px_1fr] gap-4"
                  >
                    <div className="pt-5 text-xs font-medium text-[#786f82]">{block.time}</div>
                    <div className="relative border-l border-white/[.075] pb-6 pl-5 pt-5">
                      <span className="absolute -left-[5px] top-6 h-[9px] w-[9px] rounded-full border border-black" style={{ background: project?.accent ?? "#8b5cf6", boxShadow: "0 0 15px rgba(139,92,246,.45)" }} />
                      <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#82798d]">{project?.name}</div>
                      <div className="mt-1.5 text-sm text-[#e2dee6]">{block.title}</div>
                      <div className="mt-1 text-[10px] text-[#5f5769]">{block.time} — {block.end}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={reveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: .15 }}
        transition={{ duration: .7 }}
        className="mt-16 grid gap-5 xl:grid-cols-[.72fr_1.28fr]"
      >
        <div className="glass rounded-[30px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#71697d]">Inbox</div>
              <h3 className="mt-2 text-xl font-semibold">Ideas fuera del camino</h3>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#8b5cf6]/15 bg-[#8b5cf6]/[.06] text-xs text-[#c1adff]">{inbox.length}</span>
          </div>
          <div className="mt-6 space-y-3">
            {inbox.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/[.055] bg-black/20 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#766e80]">{item.type}</div>
                <div className="mt-2 text-sm leading-6 text-[#c9c3ce]">{item.content}</div>
              </div>
            ))}
          </div>
          <Link href="/ideas" className="mt-5 flex items-center gap-2 text-xs font-medium text-[#ad92ff]">Procesar inbox <ArrowRight size={13} /></Link>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/[.07] bg-black/35 p-6 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px neon-line opacity-50" />
          <div className="grid gap-7 md:grid-cols-[1fr_.8fr] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#756c80]">
                <BrainCircuit size={14} className="text-[#a98cff]" /> Nexus signal
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-.03em]">El sistema detecta el ruido antes de que tú lo conviertas en prioridad.</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#89818f]">
                CRISCASA concentra el riesgo inmediato. La tesis necesita un bloque largo después. Todo lo demás puede esperar sin desaparecer.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-[#9d83ed]"><CheckCircle2 size={13} /> Basado en prioridades actuales</div>
            </div>
            <div className="rounded-[24px] border border-white/[.06] bg-white/[.018] p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[.16em] text-[#6c6475]">Today completion</div>
                  <div className="mt-2 text-5xl font-light tracking-[-.06em]">56%</div>
                </div>
                <span className="text-xs text-[#716979]">2h 34 / 4h 30</span>
              </div>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[.055]">
                <div className="h-full w-[56%] rounded-full bg-gradient-to-r from-[#6d28d9] via-[#8b5cf6] to-[#c4b5fd] shadow-[0_0_18px_rgba(139,92,246,.45)]" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={reveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: .12 }}
        transition={{ duration: .72 }}
        className="mt-20 pb-6"
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#71697d]">WIP · 5/5</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Proyectos activos</h2>
          </div>
          <Link href="/projects" className="flex items-center gap-2 text-xs font-medium text-[#ad92ff]">Ver todos <ArrowRight size={13} /></Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {active.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </motion.section>
    </div>
  );
}
