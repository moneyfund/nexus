"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={"/projects/" + project.id} className="group glass block rounded-[24px] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/[.13]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#667187]">{project.area}</div>
          <h3 className="mt-2 text-lg font-semibold tracking-[-.02em]">{project.name}</h3>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/[.03] text-[#6e7890] transition group-hover:text-white"><ArrowUpRight size={16} /></div>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-light tracking-[-.05em]">{project.progress}%</span>
          <span className="text-[10px] uppercase tracking-[.16em] text-[#687388]">{project.deadline}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.055]">
          <div className="h-full rounded-full" style={{ width: project.progress + "%", background: "linear-gradient(90deg, " + project.accent + ", #b9c0ff)" }} />
        </div>
      </div>

      <div className="mt-5 border-t border-white/[.055] pt-4">
        <div className="text-[10px] uppercase tracking-[.16em] text-[#59647a]">Next action</div>
        <div className="mt-1.5 line-clamp-2 text-sm leading-5 text-[#c2c8d6]">{project.nextAction}</div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#697489]"><Clock3 size={12} /> {project.hours.toFixed(1)} h acumuladas</div>
      </div>
    </Link>
  );
}
