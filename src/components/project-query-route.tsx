"use client";

import { useSearchParams } from "next/navigation";
import { ProjectDetail } from "./project-detail";

export function ProjectQueryRoute() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";
  return <ProjectDetail id={id} />;
}
