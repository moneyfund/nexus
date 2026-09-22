"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/domain/models";
import { Badge, ProgressRing } from "./ui/primitives";
export function ProjectCard({ project: p }: { project: Project }) {
  return (
    <Link href={"/projects/" + p.id} className="project-card">
      <div className="row between">
        <Badge active={p.status === "active"}>{p.status.toUpperCase()}</Badge>
        <ArrowUpRight size={17} />
      </div>
      <ProgressRing value={p.progress} size={110} />
      <h3>{p.name}</h3>
      <p>{p.nextAction}</p>
      <div className="row between small muted">
        <span>{p.hours.toFixed(1)} h</span>
        <span>{p.deadline}</span>
      </div>
    </Link>
  );
}
