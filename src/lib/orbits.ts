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
  if (quality === "low")
    return {
      particles: 320,
      dpr: 1,
      fps: 16,
      interactionFps: 30,
      ringCount: 10,
      armSamples: 42,
    };
  if (mobile)
    return {
      particles: 520,
      dpr: 1.1,
      fps: 20,
      interactionFps: 30,
      ringCount: 10,
      armSamples: 48,
    };
  if (quality === "high")
    return {
      particles: 1600,
      dpr: 1.5,
      fps: 30,
      interactionFps: 60,
      ringCount: 16,
      armSamples: 64,
    };
  return {
    particles: 980,
    dpr: 1.25,
    fps: 22,
    interactionFps: 45,
    ringCount: 12,
    armSamples: 52,
  };
}
