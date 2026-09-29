import { Suspense } from "react";
import { ProjectQueryRoute } from "@/components/project-query-route";

export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectQueryRoute />
    </Suspense>
  );
}
