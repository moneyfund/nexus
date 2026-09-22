"use client";

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { useNexus } from "@/components/nexus-provider";
import { ProjectCard } from "@/components/project-card";
import type { ProjectStatus } from "@/lib/types";

const filters: { label: string; value: "all" | ProjectStatus }[] = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Backlog", value: "backlog" },
  { label: "En espera", value: "waiting" },
  { label: "Completados", value: "completed" }
];

export function ProjectsView() {
  const { projects } = useNexus();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => projects.filter((project) => {
    const matchesFilter = filter === "all" || project.status === filter;
    const q = query.toLowerCase();
    return matchesFilter && (project.name.toLowerCase().includes(q) || project.area.toLowerCase().includes(q));
  }), [projects, filter, query]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#657087]">Execution portfolio</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Projects</h1>
          <p className="mt-2 text-sm text-[#758097]">Todo puede existir aquí. Solo cinco proyectos activos pueden consumir calendario.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/[.065] bg-white/[.025] px-3 py-2.5">
          <Search size={15} className="text-[#59657a]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto..." className="w-56 bg-transparent text-sm outline-none placeholder:text-[#4d576a]" />
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-2 text-xs text-[#5f6a80]"><Filter size={14} /> Filtro</span>
        {filters.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={"rounded-full border px-3.5 py-1.5 text-xs transition " + (filter === item.value ? "border-[#7481ff]/35 bg-[#7481ff]/10 text-[#aab2ff]" : "border-white/[.06] bg-white/[.02] text-[#69748a] hover:text-white")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
      </div>
    </div>
  );
}
