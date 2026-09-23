import { WorkspaceStore } from "@/repositories/workspace";
import { entity } from "@/domain/seed";
import { flowElapsed } from "@/domain/selectors";
import { zonedISO } from "@/lib/time";
import { SYSTEM } from "@/config/system";
import type {
  CaptureInput,
  Project,
  ProjectStatus,
  Idea,
  Workspace,
  Task,
  CalendarEvent,
  UserPreferences,
  Milestone,
  MoneyRecord,
 } from "@/domain/models";
const id = () => crypto.randomUUID();
const log = (w: Workspace, title: string, kind: string, projectId?: string) => {
  w.activity.unshift({
    ...entity(id(), "user", w.user.id),
    title,
    kind,
    projectId,
  });
};
const clampProgress = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

function recomputeMilestone(project: Project, milestone: Milestone) {
  const related = project.tasks.filter(
    (task) => task.milestone === milestone.title,
  );
  const completed = related.filter((task) => task.completed).length;
  const ratio = related.length ? completed / related.length : 0;

  if (milestone.baselineProgress == null) {
    const inferred =
      related.length && ratio < 1
        ? (milestone.progress - 100 * ratio) / (1 - ratio)
        : milestone.progress;
    milestone.baselineProgress = clampProgress(inferred);
  }

  if (related.length) {
    milestone.progress = clampProgress(
      milestone.baselineProgress +
        (100 - milestone.baselineProgress) * ratio,
    );
  } else {
    milestone.progress = clampProgress(milestone.baselineProgress);
  }

  milestone.updatedAt = Date.now();
}

function recomputeProject(project: Project) {
  project.milestones.forEach((milestone) =>
    recomputeMilestone(project, milestone),
  );

  const totalWeight = project.milestones.reduce(
    (sum, milestone) => sum + Math.max(0, milestone.weight),
    0,
  );

  project.progress = totalWeight
    ? clampProgress(
        project.milestones.reduce(
          (sum, milestone) =>
            sum + milestone.progress * Math.max(0, milestone.weight),
          0,
        ) / totalWeight,
      )
    : project.tasks.length
      ? clampProgress(
          (project.tasks.filter((task) => task.completed).length /
            project.tasks.length) *
            100,
        )
      : 0;

  project.nextAction =
    project.tasks.find((task) => !task.completed)?.title ??
    (project.progress >= 100
      ? "Proyecto completado"
      : "Definir la siguiente acción");
  project.updatedAt = Date.now();
}

function complete(
  w: Workspace,
  projectId: string,
  taskId: string,
  value?: boolean,
) {
  const p = w.projects.find((p) => p.id === projectId);
  const task = p?.tasks.find((t) => t.id === taskId);
  if (!p || !task) return;
  const blocked = w.dependencies
    .filter((d) => d.taskId === taskId)
    .some(
      (d) =>
        !w.projects
          .flatMap((p) => p.tasks)
          .find((t) => t.id === d.dependsOnTaskId)?.completed,
    );
  if ((value ?? !task.completed) && blocked)
    throw new Error("Completa primero las tareas de las que depende.");
  task.completed = value ?? !task.completed;
  task.completedAt = task.completed ? Date.now() : undefined;
  task.updatedAt = Date.now();
  recomputeProject(p);
  log(
    w,
    (task.completed ? "Completada: " : "Reabierta: ") + task.title,
    "task",
    p.id,
  );
}
function newProject(name: string, userId: string, description = ""): Project {
  return {
    ...entity(id(), "user", userId),