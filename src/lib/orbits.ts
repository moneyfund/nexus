import type { ProjectStatus, UserPreferences } from "@/domain/models";

export const orbitOrder: ProjectStatus[] = [
  "active",
  "waiting",
  "backlog",
  "completed",
];
export const orbitLabels: Record<ProjectStatus, string> = {
  active: "Activos",
  waiting: "En espera",
  backlog: "Backlog",
  completed: "Completados",
};
export const orbitRadii: Record<ProjectStatus, number> = {
  active: 2.15,
  waiting: 3.4,
  backlog: 4.65,
  completed: 5.85,
};

// Keep every node inside its status band, even for unusually large workspaces.
export function orbitPosition(
  status: ProjectStatus,
  index: number,
  count: number,
) {
  return {
    radius: orbitRadii[status] + (index % 3) * 0.12,
    angle:
      (index / Math.max(count, 1)) * Math.PI * 2 +
      orbitOrder.indexOf(status) * 0.83 +
      0.5,
    speed: {
      active: 0.000028,
      waiting: 0.000018,
      backlog: 0.000012,
      completed: 0.000008,
    }[status],
  };
}

export function galaxyBudget(
  quality: UserPreferences["quality"],
  width: number,
) {
  const mobile = width < 600;
  return {
    particles:
      quality === "low" ? 420 : mobile ? 760 : quality === "high" ? 2600 : 1900,
    dpr: quality === "low" ? 1 : mobile ? 1.25 : quality === "high" ? 2 : 1.5,
    fps: quality === "low" || mobile ? 30 : 60,
  };
}
