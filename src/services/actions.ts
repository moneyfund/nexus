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
  const m = p.milestones.find((m) => m.title === task.milestone);
  const related = p.tasks.filter((t) => t.milestone === task.milestone);
  if (m && related.length) {
    m.progress = Math.round(
      (related.filter((t) => t.completed).length / related.length) * 100,
    );
    m.updatedAt = Date.now();
  }
  const weight = p.milestones.reduce((s, m) => s + m.weight, 0);
  p.progress = weight
    ? Math.round(
        p.milestones.reduce((s, m) => s + m.progress * m.weight, 0) / weight,
      )
    : Math.round(
        (p.tasks.filter((t) => t.completed).length / p.tasks.length) * 100,
      );
  p.nextAction =
    p.tasks.find((t) => !t.completed)?.title ?? "Revisar entrega del proyecto";
  p.updatedAt = Date.now();
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
    name,
    description,
    area: "Personal",
    progress: 0,
    status: "backlog",
    priority: "medium",
    deadline: "SIN FECHA",
    accent: "#d946ef",
    tasks: [],
    milestones: [],
    nextAction: "Definir la primera acción",
    hours: 0,
    stage: "discovery",
  };
}
export class NexusActions {
  constructor(private store: WorkspaceStore) {}
  capture = (input: CaptureInput) => {
    const content = input.content.trim();
    if (!content) throw new Error("Escribe algo antes de capturar.");
    if (
      (input.type === "income" || input.type === "expense") &&
      (!Number.isFinite(input.amount) || (input.amount ?? 0) <= 0)
    )
      throw new Error("Introduce un importe mayor que cero.");
    if (input.type === "link") {
      const url = new URL(input.url || content);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Usa un enlace HTTP o HTTPS.");
    }
    if (input.type === "task" && !input.projectId)
      throw new Error("Elige un proyecto para esta tarea.");
    const targetId = id();
    this.store.update((w) => {
      const base = entity(targetId, "user", w.user.id);
      if (input.projectId && !w.projects.some((p) => p.id === input.projectId))
        throw new Error("Proyecto no encontrado.");
      switch (input.type) {
        case "idea":
          w.ideas.unshift({
            ...base,
            title: content,
            description: "",
            category: input.category ?? "Ideas",
            status: "captured",
            potential: "explore",
            projectIds: input.projectId ? [input.projectId] : [],
            notes: "",
          });
          break;
        case "project":
          w.projects.unshift({
            ...newProject(content, w.user.id),
            id: targetId,
          });
          break;
        case "task": {
          const p = w.projects.find((p) => p.id === input.projectId);
          if (p) {
            p.tasks.push({
              ...base,
              projectId: p.id,
              title: content,
              completed: false,
              estimatedMinutes: 25,
              priority: "medium",
              milestone: p.milestones[0]?.title ?? "Ejecución",
            });
            p.nextAction = p.tasks.find((t) => !t.completed)?.title ?? content;
            p.updatedAt = Date.now();
          }
          break;
        }
        case "income":
        case "expense": {
          const record = {
            ...base,
            title: content,
            amount: Math.round(input.amount! * 100) / 100,
            currency: "USD" as const,
            date: new Intl.DateTimeFormat("en-CA", {
              timeZone: w.user.preferences.timezone,
            }).format(new Date()),
            projectId: input.projectId || undefined,
            category: input.category ?? "General",
          };
          w[input.type === "income" ? "incomes" : "expenses"].unshift(record);
          break;
        }
        case "contact":
          w.contacts.unshift({ ...base, name: content });
          break;
        case "file": {
          if (!input.file) throw new Error("Selecciona un archivo.");
          w.attachments.push({
            ...base,
            name: input.file.name,
            mimeType: input.file.type,
            size: input.file.size,
            provider: input.file.provider ?? "mock",
            externalId: input.file.externalId,
            projectId: input.projectId,
          });
          w.knowledge.unshift({
            ...base,
            title: content,
            content:
              input.file.provider === "firebase"
                ? "Archivo almacenado en Firebase Storage."
                : "Referencia local: el contenido del archivo no se ha subido.",
            type: input.file.type === "application/pdf" ? "pdf" : "document",
            category: input.category ?? "Personal",
            tags: [],
            projectId: input.projectId,
            attachmentId: targetId,
          });
          break;
        }
        default:
          w.knowledge.unshift({
            ...base,
            title: content.split("\n")[0],
            content,
            type: input.type === "link" ? "link" : "note",
            url: input.type === "link" ? input.url || content : undefined,
            category: input.category ?? "Personal",
            projectId: input.projectId,
            tags: [],
          });
      }
      w.inbox.unshift({
        ...entity(id(), "user", w.user.id),
        type: input.type,
        content,
        targetId,
      });
      log(w, "Capturado: " + content, "capture", input.projectId);
    });
    return targetId;
  };
  toggleTask = (projectId: string, taskId: string) =>
    this.store.update((w) => complete(w, projectId, taskId));
  setStatus = (projectId: string, status: ProjectStatus) =>
    this.store.update((w) => {
      const p = w.projects.find((p) => p.id === projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      if (
        status === "active" &&
        p.status !== "active" &&
        w.projects.filter((p) => p.status === "active").length >=
          SYSTEM.wipLimit
      )
        throw new Error(
          "Tu capacidad activa está completa. Pausa o termina un proyecto para abrir este frente.",
        );
      p.status = status;
      p.updatedAt = Date.now();
      log(w, p.name + " → " + status, "project", p.id);
    });
  updateProject = (
    projectId: string,
    patch: Partial<
      Pick<
        Project,
        | "name"
        | "description"
        | "notes"
        | "priority"
        | "dueDate"
        | "value"
        | "dependsOn"
        | "contactIds"
      >
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((p) => p.id === projectId);
      if (p) {
        Object.assign(p, patch, { updatedAt: Date.now() });
        if ("dueDate" in patch)
          p.deadline = patch.dueDate
            ? new Intl.DateTimeFormat("es-NI", {
                day: "2-digit",
                month: "short",
                timeZone: "UTC",
              }).format(new Date(patch.dueDate + "T12:00:00Z"))
            : "SIN FECHA";
      }
    });
  updateIdea = (
    ideaId: string,
    patch: Partial<
      Pick<
        Idea,
        | "title"
        | "description"
        | "notes"
        | "category"
        | "potential"
        | "status"
        | "projectIds"
        | "reviewDate"
      >
    >,
  ) =>
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (idea) Object.assign(idea, patch, { updatedAt: Date.now() });
    });
  convertIdea = (ideaId: string) => {
    let projectId = "";
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (!idea) throw new Error("Idea no encontrada.");
      if (idea.status === "converted") {
        projectId = idea.projectIds[0] ?? "";
        return;
      }
      const p = newProject(idea.title, w.user.id, idea.description);
      p.area = idea.category;
      p.notes = idea.notes;
      w.projects.unshift(p);
      projectId = p.id;
      idea.status = "converted";
      idea.projectIds.unshift(p.id);
      idea.updatedAt = Date.now();
      log(w, "Idea convertida en proyecto: " + idea.title, "conversion", p.id);
    });
    return projectId;
  };
  deleteIdea = (ideaId: string) =>
    this.store.update((w) => {
      w.ideas = w.ideas.filter((i) => i.id !== ideaId);
      w.inbox = w.inbox.filter((i) => i.targetId !== ideaId);
    });
  scheduleReview = (ideaId: string, date: string) =>
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (!idea || !date) throw new Error("Selecciona una fecha.");
      idea.reviewDate = date;
      idea.status = "review";
      idea.updatedAt = Date.now();
      const start = new Date(
        zonedISO(date + "T09:00", w.user.preferences.timezone),
      );
      const existing = w.events.find((e) => e.metadata?.ideaId === ideaId);
      const event: CalendarEvent = {
        ...entity(existing?.id ?? id(), "user", w.user.id),
        title: "Revisar: " + idea.title,
        start: start.toISOString(),
        end: new Date(+start + 30 * 60000).toISOString(),
        category: "admin",
        metadata: { ideaId },
      };
      if (existing) Object.assign(existing, event);
      else w.events.push(event);
    });
  startFlow = (projectId: string, taskId: string, duration?: number) =>
    this.store.update((w) => {
      if (w.activeFlow)
        throw new Error(
          "Ya hay una sesión abierta. Termínala antes de iniciar otra.",
        );
      const p = w.projects.find((p) => p.id === projectId);
      const task = p?.tasks.find((t) => t.id === taskId);
      if (!p || !task || task.completed)
        throw new Error("Selecciona una tarea pendiente.");
      if (p.status !== "active")
        throw new Error("Activa el proyecto antes de iniciar Flow.");
      w.activeFlow = {
        ...entity(id(), "user", w.user.id),
        projectId,
        taskId,
        title: task.title,
        projectName: p.name,
        startedAt: Date.now(),
        durationMinutes: Math.max(
          1,
          Math.min(480, duration ?? task.estimatedMinutes),
        ),
        pausedMs: 0,
      };
    });
  pauseFlow = () =>
    this.store.update((w) => {
      if (!w.activeFlow) return;
      const f = w.activeFlow;
      if (f.pausedAt) {
        f.pausedMs += Date.now() - f.pausedAt;
        delete f.pausedAt;
      } else f.pausedAt = Date.now();
      f.updatedAt = Date.now();
    });
  endFlow = (completeTask = false) => {
    let result = this.store.getSnapshot().activeFlow;
    this.store.update((w) => {
      const f = w.activeFlow;
      if (!f) return;
      f.elapsedSeconds = flowElapsed(f);
      f.endedAt = f.pausedAt ?? Date.now();
      f.updatedAt = Date.now();
      f.completed = completeTask;
      if (completeTask) complete(w, f.projectId, f.taskId, true);
      const p = w.projects.find((p) => p.id === f.projectId);
      if (p) {
        p.hours += f.elapsedSeconds / 3600;
        p.updatedAt = Date.now();
      }
      w.flows.unshift(f);
      log(
        w,
        `Flow · ${Math.round(f.elapsedSeconds / 60)} min · ${f.title}`,
        "flow",
        f.projectId,
      );
      result = f;
      w.activeFlow = null;
    });
    return result;
  };
  saveEvent = (event: CalendarEvent) =>
    this.store.update((w) => {
      if (
        event.userId !== w.user.id ||
        !event.title.trim() ||
        !Number.isFinite(+new Date(event.start)) ||
        +new Date(event.end) <= +new Date(event.start)
      )
        throw new Error("Revisa el título y las horas del bloque.");
      const i = w.events.findIndex((e) => e.id === event.id);
      if (i < 0) w.events.push(event);
      else w.events[i] = { ...event, updatedAt: Date.now() };
    });
  deleteEvent = (eventId: string) =>
    this.store.update((w) => {
      w.events = w.events.filter((e) => e.id !== eventId);
    });
  updatePreferences = (patch: Partial<UserPreferences>) =>
    this.store.update((w) => {
      Object.assign(w.user.preferences, patch);
      w.user.updatedAt = Date.now();
    });
  updateProfile = (name: string, email: string) =>
    this.store.update((w) => {
      if (!name.trim()) throw new Error("Introduce tu nombre.");
      w.user.name = name.trim();
      w.user.email = email;
      w.user.initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    });
  readNotifications = (notificationId?: string) =>
    this.store.update((w) => {
      w.notifications.forEach((n) => {
        if (!notificationId || n.id === notificationId) n.read = true;
      });
    });
  processInbox = (inboxId: string) =>
    this.store.update((w) => {
      const item = w.inbox.find((i) => i.id === inboxId);
      if (item) item.processed = true;
    });
  toggleGoal = (goalId: string, milestoneId: string) =>
    this.store.update((w) => {
      const g = w.goals.find((g) => g.id === goalId);
      const m = g?.milestones.find((m) => m.id === milestoneId);
      if (m) {
        m.completed = !m.completed;
        m.updatedAt = Date.now();
      }
    });
  addDependency = (task: Task, dependsOnTaskId: string) =>
    this.store.update((w) => {
      if (
        task.id === dependsOnTaskId ||
        !w.projects
          .flatMap((p) => p.tasks)
          .some((t) => t.id === dependsOnTaskId)
      )
        throw new Error("Dependencia inválida.");
      const visited = new Set<string>();
      const cycle = (current: string): boolean => {
        if (current === task.id) return true;
        if (visited.has(current)) return false;
        visited.add(current);
        return w.dependencies
          .filter((d) => d.taskId === current)
          .some((d) => cycle(d.dependsOnTaskId));
      };
      if (cycle(dependsOnTaskId))
        throw new Error("Esta dependencia crearía un ciclo.");
      if (
        !w.dependencies.some(
          (d) => d.taskId === task.id && d.dependsOnTaskId === dependsOnTaskId,
        )
      )
        w.dependencies.push({
          ...entity(id(), "user", w.user.id),
          taskId: task.id,
          dependsOnTaskId,
        });
    });
}
