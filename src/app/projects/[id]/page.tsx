import { ProjectDetail } from "@/components/project-detail";
import { initialProjects } from "@/lib/mock-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return initialProjects.map((project) => ({ id: project.id }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
