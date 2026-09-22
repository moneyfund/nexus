"use client";

import { BarChart3, BrainCircuit, CheckCircle2, Lightbulb, Target, TrendingUp, Wallet } from "lucide-react";
import { todayBlocks } from "@/lib/mock-data";
import { useNexus } from "@/components/nexus-provider";

export function CalendarView() {
  const { projects } = useNexus();
  const days = ["LUN 21", "MAR 22", "MIÉ 23", "JUE 24", "VIE 25"];

  return (
    <ModuleFrame eyebrow="Time architecture" title="Calendar" description="Tu tiempo deja de ser una intención y se convierte en bloques protegidos.">
      <div className="grid gap-4 lg:grid-cols-5">
        {days.map((day, index) => {
          const blocks = index === 1 ? todayBlocks : todayBlocks.slice(index % 2, 2 + (index % 3));
          return (
            <div key={day} className={"glass min-h-[420px] rounded-[24px] p-4 " + (index === 1 ? "border-[#7380ff]/25" : "")}>
              <div className="text-[10px] font-semibold tracking-[.15em] text-[#69758c]">{day}</div>
              <div className="mt-5 space-y-3">
                {blocks.map((block) => {
                  const project = projects.find((item) => item.id === block.projectId);
                  return (
                    <div key={block.time + block.title} className="rounded-2xl border border-white/[.06] bg-white/[.025] p-3" style={{ borderLeftColor: project?.accent, borderLeftWidth: 2 }}>
                      <div className="text-[10px] text-[#657087]">{block.time} — {block.end}</div>
                      <div className="mt-1.5 text-xs font-medium">{project?.name}</div>
                      <div className="mt-1 text-[11px] leading-4 text-[#737e94]">{block.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ModuleFrame>
  );
}

export function FinanceView() {
  const metrics = [
    { label: "Cobrado este mes", value: "$1,250", meta: "+18%" },
    { label: "Por cobrar", value: "$720", meta: "3 proyectos" },
    { label: "Gastos", value: "$480", meta: "38% ingresos" },
    { label: "Flujo neto", value: "$770", meta: "+ $190" }
  ];
  const bars = [34, 48, 41, 67, 58, 82, 76, 92, 70, 88, 96, 78];

  return (
    <ModuleFrame eyebrow="Financial command" title="Finance" description="Ingresos, cobros, gastos y rentabilidad conectados a los proyectos que los generan.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <div key={item.label} className="glass rounded-[24px] p-5">
            <Wallet size={16} className="text-[#6f7cff]" />
            <div className="mt-6 text-[10px] font-semibold uppercase tracking-[.16em] text-[#657087]">{item.label}</div>
            <div className="mt-2 text-3xl font-light">{item.value}</div>
            <div className="mt-2 text-[11px] text-[#69758c]">{item.meta}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <div className="glass rounded-[26px] p-6">
          <div className="text-sm font-semibold">Cashflow · Septiembre</div>
          <div className="mt-8 flex h-52 items-end gap-3">
            {bars.map((height, index) => <div key={index} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#5967ee]/45 to-[#37d7ff]/80" style={{ height: height + "%" }} />)}
          </div>
        </div>
        <div className="glass rounded-[26px] p-6">
          <div className="text-sm font-semibold">Meta mensual</div>
          <div className="mt-7 text-5xl font-light tracking-[-.06em]">62%</div>
          <div className="mt-4 h-2 rounded-full bg-white/[.055]"><div className="h-full w-[62%] rounded-full bg-gradient-to-r from-[#6f7cff] to-[#4ee3a1]" /></div>
          <p className="mt-5 text-xs leading-5 text-[#707b90]">$1,250 de una meta provisional de $2,000.</p>
        </div>
      </div>
    </ModuleFrame>
  );
}

export function GoalsView() {
  const goals = [
    { title: "Lanzar XARCON formalmente", date: "2027", progress: "44%", meta: "Portfolio · marca · ventas · estructura" },
    { title: "Completar Ingeniería Civil", date: "Q4 2026", progress: "63%", meta: "Tesis · defensa · titulación" },
    { title: "Construir NEXUS OS", date: "Q4 2026", progress: "12%", meta: "Core · Calendar · Finance · AI" }
  ];

  return (
    <ModuleFrame eyebrow="Direction layer" title="Goals" description="Las tareas solamente importan si empujan una dirección.">
      <div className="grid gap-4 lg:grid-cols-3">
        {goals.map((goal) => (
          <div key={goal.title} className="glass rounded-[26px] p-6">
            <Target size={18} className="text-[#7c87ff]" />
            <div className="mt-5 text-[10px] uppercase tracking-[.16em] text-[#667187]">{goal.date}</div>
            <h3 className="mt-2 text-xl font-semibold">{goal.title}</h3>
            <p className="mt-2 text-xs leading-5 text-[#727d92]">{goal.meta}</p>
            <div className="mt-7 flex items-end justify-between"><span className="text-3xl font-light">{goal.progress}</span><span className="text-[10px] text-[#5b6578]">PROGRESS</span></div>
          </div>
        ))}
      </div>
    </ModuleFrame>
  );
}

export function IdeasView() {
  const { inbox, setCaptureOpen } = useNexus();
  return (
    <ModuleFrame eyebrow="Opportunity vault" title="Ideas & Inbox" description="Las ideas se capturan inmediatamente, pero no obtienen prioridad automáticamente.">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div><div className="text-xs text-[#657087]">{inbox.length} elementos sin procesar</div><h3 className="mt-1 text-lg font-semibold">Universal Inbox</h3></div>
          <button onClick={() => setCaptureOpen(true)} className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#080b12]">Capturar</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inbox.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4">
              <Lightbulb size={15} className="text-[#ffbf69]" />
              <div className="mt-4 text-[9px] uppercase tracking-[.17em] text-[#667187]">{item.type}</div>
              <div className="mt-2 text-sm leading-6 text-[#ccd1dc]">{item.content}</div>
            </div>
          ))}
        </div>
      </div>
    </ModuleFrame>
  );
}

export function AnalyticsView() {
  const values = [46, 62, 55, 78, 69, 84, 73, 88, 67, 91, 76, 83, 94, 86];
  const cards = [
    { label: "Completion rate", value: "82%", meta: "Tareas terminadas / planificadas", icon: CheckCircle2 },
    { label: "Deep work avg.", value: "3.4h", meta: "Promedio diario", icon: BarChart3 },
    { label: "Best window", value: "09:30", meta: "Mayor tasa de finalización", icon: BrainCircuit }
  ];

  return (
    <ModuleFrame eyebrow="Personal intelligence" title="Analytics" description="Datos de ejecución para entender cómo trabajas realmente, no cómo crees que trabajas.">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="glass rounded-[28px] p-6">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Execution rate · 14 días</h3><TrendingUp size={17} className="text-[#4ee3a1]" /></div>
          <div className="mt-9 flex h-64 items-end gap-2">{values.map((value, index) => <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#5967ee]/35 to-[#7885ff]" style={{ height: value + "%" }} />)}</div>
          <div className="mt-4 flex justify-between text-[10px] text-[#576174]"><span>09 SEP</span><span>22 SEP</span></div>
        </div>
        <div className="space-y-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="glass rounded-[24px] p-5">
                <Icon size={16} className="text-[#7b87ff]" />
                <div className="mt-5 text-[10px] uppercase tracking-[.16em] text-[#657087]">{card.label}</div>
                <div className="mt-1 text-3xl font-light">{card.value}</div>
                <div className="mt-2 text-[11px] text-[#69758c]">{card.meta}</div>
              </div>
            );
          })}
        </div>
      </div>
    </ModuleFrame>
  );
}

function ModuleFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-7">
        <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#657087]">{eyebrow}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758097]">{description}</p>
      </div>
      {children}
    </div>
  );
}
