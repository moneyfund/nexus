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
  ProjectStage,
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
  const related = project.tasks.filter((task) => task.milestone === milestone.title);
  if (milestone.baselineProgress == null)
    milestone.baselineProgress = clampProgress(milestone.progress);

  if (related.length) {
    const completed = related.filter((task) => task.completed).length;
    const ratio = completed / related.length;
    milestone.progress = clampProgress(
      milestone.baselineProgress + (100 - milestone.baselineProgress) * ratio,
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
            recomputeProject(p);
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
            provider: "mock",
            projectId: input.projectId,
          });
          w.knowledge.unshift({
            ...base,
            title: content,
            content:
              "Preparando archivo para Firebase Storage.",
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
        | "area"
        | "client"
        | "stage"
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

  addMilestone = (
    projectId: string,
    title: string,
    weight = 10,
    baselineProgress = 0,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      const clean = title.trim();
      if (!clean) throw new Error("Escribe un nombre para el hito.");
      if (p.milestones.some((milestone) => milestone.title === clean))
        throw new Error("Ya existe un hito con ese nombre.");
      p.milestones.push({
        ...entity(id(), "user", w.user.id),
        projectId,
        title: clean,
        weight: Math.max(0, weight),
        progress: clampProgress(baselineProgress),
        baselineProgress: clampProgress(baselineProgress),
      });
      recomputeProject(p);
      log(w, "Hito creado: " + clean, "milestone", projectId);
    });

  updateMilestone = (
    projectId: string,
    milestoneId: string,
    patch: Partial<
      Pick<Milestone, "title" | "weight" | "baselineProgress">
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const milestone = p?.milestones.find((item) => item.id === milestoneId);
      if (!p || !milestone) throw new Error("Hito no encontrado.");

      const previousTitle = milestone.title;
      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("El hito necesita un nombre.");
        if (
          p.milestones.some(
            (item) => item.id !== milestoneId && item.title === clean,
          )
        )
          throw new Error("Ya existe un hito con ese nombre.");
        milestone.title = clean;
        p.tasks
          .filter((task) => task.milestone === previousTitle)
          .forEach((task) => {
            task.milestone = clean;
            task.updatedAt = Date.now();
          });
      }
      if (patch.weight != null) milestone.weight = Math.max(0, patch.weight);
      if (patch.baselineProgress != null)
        milestone.baselineProgress = clampProgress(patch.baselineProgress);

      recomputeProject(p);
      log(w, "Hito actualizado: " + milestone.title, "milestone", projectId);
    });

  deleteMilestone = (projectId: string, milestoneId: string) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const milestone = p?.milestones.find((item) => item.id === milestoneId);
      if (!p || !milestone) throw new Error("Hito no encontrado.");
      if (p.tasks.some((task) => task.milestone === milestone.title))
        throw new Error(
          "Mueve o elimina primero las tareas asociadas a este hito.",
        );
      p.milestones = p.milestones.filter((item) => item.id !== milestoneId);
      recomputeProject(p);
      log(w, "Hito eliminado: " + milestone.title, "milestone", projectId);
    });

  updateTask = (
    projectId: string,
    taskId: string,
    patch: Partial<
      Pick<Task, "title" | "estimatedMinutes" | "priority" | "milestone">
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const task = p?.tasks.find((item) => item.id === taskId);
      if (!p || !task) throw new Error("Tarea no encontrada.");
      const previousMilestone = task.milestone;

      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("La tarea necesita un título.");
        task.title = clean;
      }
      if (patch.estimatedMinutes != null)
        task.estimatedMinutes = Math.max(1, Math.round(patch.estimatedMinutes));
      if (patch.priority != null) task.priority = patch.priority;
      if (patch.milestone != null) {
        if (
          patch.milestone &&
          !p.milestones.some((milestone) => milestone.title === patch.milestone)
        )
          throw new Error("El hito seleccionado no existe.");
        task.milestone = patch.milestone || "Ejecución";
      }

      task.updatedAt = Date.now();
      if (previousMilestone !== task.milestone) {
        const previous = p.milestones.find(
          (milestone) => milestone.title === previousMilestone,
        );
        if (previous) recomputeMilestone(p, previous);
      }
      recomputeProject(p);
      log(w, "Tarea actualizada: " + task.title, "task", projectId);
    });

  deleteTask = (projectId: string, taskId: string) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const task = p?.tasks.find((item) => item.id === taskId);
      if (!p || !task) throw new Error("Tarea no encontrada.");
      p.tasks = p.tasks.filter((item) => item.id !== taskId);
      w.dependencies = w.dependencies.filter(
        (dependency) =>
          dependency.taskId !== taskId &&
          dependency.dependsOnTaskId !== taskId,
      );
      if (w.activeFlow?.taskId === taskId) w.activeFlow = null;
      recomputeProject(p);
      log(w, "Tarea eliminada: " + task.title, "task", projectId);
    });

  updateMoneyRecord = (
    kind: "income" | "expense",
    recordId: string,
    patch: Partial<
      Pick<MoneyRecord, "title" | "amount" | "date" | "projectId" | "category">
    >,
  ) =>
    this.store.update((w) => {
      const collection = kind === "income" ? w.incomes : w.expenses;
      const record = collection.find((item) => item.id === recordId);
      if (!record) throw new Error("Movimiento no encontrado.");
      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("El movimiento necesita un título.");
        record.title = clean;
      }
      if (patch.amount != null) {
        if (!Number.isFinite(patch.amount) || patch.amount <= 0)
          throw new Error("El importe debe ser mayor que cero.");
        record.amount = Math.round(patch.amount * 100) / 100;
      }
      if (patch.date != null) record.date = patch.date;
      if ("projectId" in patch) {
        if (
          patch.projectId &&
          !w.projects.some((project) => project.id === patch.projectId)
        )
          throw new Error("Proyecto no encontrado.");
        record.projectId = patch.projectId || undefined;
      }
      if (patch.category != null) record.category = patch.category.trim() || "General";
      record.updatedAt = Date.now();
      log(
        w,
        "Movimiento actualizado: " + record.title,
        "finance",
        record.projectId,
      );
    });

  deleteMoneyRecord = (kind: "income" | "expense", recordId: string) =>
    this.store.update((w) => {
      const collection = kind === "income" ? w.incomes : w.expenses;
      const record = collection.find((item) => item.id === recordId);
      if (!record) throw new Error("Movimiento no encontrado.");
      if (kind === "income")
        w.incomes = w.incomes.filter((item) => item.id !== recordId);
      else w.expenses = w.expenses.filter((item) => item.id !== recordId);
      log(
        w,
        "Movimiento eliminado: " + record.title,
        "finance",
        record.projectId,
      );
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
