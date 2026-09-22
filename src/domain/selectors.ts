import type { FlowSession, Workspace, Project } from "./models";
export function flowElapsed(flow: FlowSession, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(
      ((flow.endedAt ?? flow.pausedAt ?? now) -
        flow.startedAt -
        flow.pausedMs) /
        1000,
    ),
  );
}
export const money = (amount: number) =>
  new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
export const dateKey = (
  date: Date | number = new Date(),
  timezone = "America/Managua",
) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function projectPaid(w: Workspace, projectId: string) {
  return w.incomes
    .filter((i) => i.projectId === projectId)
    .reduce((sum, i) => sum + i.amount, 0);
}
export function projectFinance(w: Workspace, p: Project) {
  const paid = projectPaid(w, p.id);
  const expenses = w.expenses
    .filter((e) => e.projectId === p.id)
    .reduce((s, e) => s + e.amount, 0);
  return {
    paid,
    expenses,
    receivable: Math.max(0, (p.value ?? 0) - paid),
    profit: paid - expenses,
    revenueHour: p.hours ? paid / p.hours : 0,
    contractedHour: p.hours ? (p.value ?? 0) / p.hours : 0,
  };
}
export function analytics(w: Workspace) {
  const tasks = w.projects.flatMap((p) => p.tasks);
  const completed = tasks.filter((t) => t.completed).length;
  const seconds = w.flows.reduce((s, f) => s + (f.elapsedSeconds ?? 0), 0);
  const converted = w.ideas.filter((i) => i.status === "converted").length;
  const completion = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const delivery = w.projects.length
    ? Math.round(
        (w.projects.filter((p) => p.status === "completed").length /
          w.projects.length) *
          100,
      )
    : 0;
  const days = [
    ...new Set(
      w.flows
        .filter((f) => (f.elapsedSeconds ?? 0) >= 60)
        .map((f) => dateKey(f.startedAt)),
    ),
  ];
  let streak = 0;
  const cursor = new Date();
  if (!days.includes(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.includes(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    completion,
    delivery,
    seconds,
    converted,
    ideaRate: w.ideas.length
      ? Math.round((converted / w.ideas.length) * 100)
      : 0,
    streak,
    score: Math.round(completion * 0.6 + delivery * 0.4),
    completed,
    totalTasks: tasks.length,
  };
}
