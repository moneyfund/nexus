import type { Workspace, Project, InboxItem } from "@/domain/models";
import { entity, seedWorkspace } from "@/domain/seed";
import { SYSTEM } from "@/config/system";

export interface WorkspaceStorage {
  read(userId: string): Workspace | null;
  write(userId: string, data: Workspace): void;
}
export function validateWorkspace(
  value: unknown,
  userId: string,
): asserts value is Workspace {
  if (!value || typeof value !== "object")
    throw new Error("La copia no contiene un espacio válido.");
  const w = value as Workspace;
  const keys = [
    "projects",
    "inbox",
    "ideas",
    "events",
    "flows",
    "goals",
    "incomes",
    "expenses",
    "financialGoals",
    "contacts",
    "knowledge",
    "attachments",
    "notifications",
    "activity",
    "messages",
    "memories",
    "aiUsage",
    "dailyPlans",
    "dependencies",
  ] as const;
  if (
    w.schemaVersion !== 2 ||
    w.user?.id !== userId ||
    !w.user.preferences ||
    keys.some((k) => !Array.isArray(w[k]))
  )
    throw new Error("La copia no es compatible con este perfil.");
  for (const key of keys)
    for (const record of w[key]) {
      if (
        !record.id ||
        record.userId !== userId ||
        !Number.isFinite(record.createdAt)
      )
        throw new Error("La copia contiene registros sin propietario válido.");
    }
  if (w.activeFlow && w.activeFlow.userId !== userId)
    throw new Error("Sesión de otro perfil.");
  const prefs = w.user.preferences;
  if (
    typeof w.user.name !== "string" ||
    typeof w.user.email !== "string" ||
    typeof w.user.initials !== "string" ||
    !["full", "reduced", "off"].includes(prefs.motion) ||
    !["auto", "low", "high"].includes(prefs.quality) ||
    !prefs.aiContext ||
    ["projects", "calendar", "finance", "knowledge"].some(
      (k) =>
        typeof prefs.aiContext[k as keyof typeof prefs.aiContext] !== "boolean",
    )
  )
    throw new Error("Preferencias incompletas en la copia.");
  try {
    new Intl.DateTimeFormat("es-NI", { timeZone: prefs.timezone }).format();
  } catch {
    throw new Error("Zona horaria inválida.");
  }
  for (const r of [...w.incomes, ...w.expenses])
    if (
      !Number.isFinite(r.amount) ||
      r.amount <= 0 ||
      r.currency !== "USD" ||
      typeof r.date !== "string" ||
      typeof r.title !== "string"
    )
      throw new Error("Movimiento financiero inválido.");
  for (const i of w.ideas)
    if (
      typeof i.title !== "string" ||
      typeof i.description !== "string" ||
      typeof i.notes !== "string" ||
      typeof i.category !== "string" ||
      !Array.isArray(i.projectIds) ||
      !["captured", "review", "converted", "archived"].includes(i.status)
    )
      throw new Error("Idea incompleta.");
  for (const k of w.knowledge)
    if (
      typeof k.title !== "string" ||
      typeof k.content !== "string" ||
      !Array.isArray(k.tags) ||
      !["note", "document", "pdf", "link", "research", "memory"].includes(
        k.type,
      ) ||
      (k.url && !/^https?:\/\//.test(k.url))
    )
      throw new Error("Referencia de conocimiento inválida.");
  for (const e of w.events)
    if (
      !e.title ||
      !Number.isFinite(+new Date(e.start)) ||
      !Number.isFinite(+new Date(e.end)) ||
      +new Date(e.end) <= +new Date(e.start)
    )
      throw new Error("Bloque de calendario inválido.");
  for (const f of [...w.flows, ...(w.activeFlow ? [w.activeFlow] : [])])
    if (
      !Number.isFinite(f.startedAt) ||
      !Number.isFinite(f.pausedMs) ||
      f.pausedMs < 0 ||
      !Number.isFinite(f.durationMinutes) ||
      f.durationMinutes <= 0
    )
      throw new Error("Sesión Flow inválida.");
  for (const g of w.goals)
    if (
      typeof g.title !== "string" ||
      !Array.isArray(g.projectIds) ||
      !Array.isArray(g.milestones) ||
      g.milestones.some((m) => m.userId !== userId || m.goalId !== g.id)
    )
      throw new Error("Meta inválida.");
  for (const g of w.financialGoals)
    if (!(g.target > 0) || !Number.isFinite(g.saved) || g.saved < 0)
      throw new Error("Meta financiera inválida.");
  for (const p of w.projects) {
    if (
      !p.name ||
      !Array.isArray(p.tasks) ||
      !Array.isArray(p.milestones) ||
      !Number.isFinite(p.progress)
    )
      throw new Error("Proyecto incompleto en la copia.");
    if (
      [...p.tasks, ...p.milestones].some(
        (t) => t.userId !== userId || t.projectId !== p.id,
      )
    )
      throw new Error("Relaciones de proyecto inválidas.");
  }
}
export function migrateLegacy(raw: unknown, userId: string): Workspace {
  const w = seedWorkspace();
  if (!raw || typeof raw !== "object")
    throw new Error("Datos anteriores no válidos.");
  const legacy = raw as { projects?: Project[]; inbox?: InboxItem[] };
  if (!Array.isArray(legacy.projects) || !Array.isArray(legacy.inbox))
    throw new Error("El espacio anterior está incompleto.");
  const now = Date.now();
  w.projects = legacy.projects.map((p) => {
    if (
      !p.id ||
      !p.name ||
      !Array.isArray(p.tasks) ||
      !Array.isArray(p.milestones)
    )
      throw new Error("No se pudo migrar un proyecto.");
    const seed = w.projects.find((s) => s.id === p.id);
    return {
      ...p,
      ...entity(p.id, seed ? "demo" : "user", userId, now),
      dueDate: p.dueDate ?? seed?.dueDate,
      tasks: p.tasks.map((t) => ({
        ...t,
        ...entity(t.id, seed ? "demo" : "user", userId, now),
        projectId: p.id,
      })),
      milestones: p.milestones.map((m) => ({
        ...m,
        ...entity(m.id, seed ? "demo" : "user", userId, now),
        projectId: p.id,
      })),
    };
  });
  w.inbox = legacy.inbox.map((i) => ({
    ...i,
    ...entity(
      i.id,
      i.id.startsWith("seed-") ? "demo" : "user",
      userId,
      i.createdAt || now,
    ),
    targetId: i.type === "idea" ? i.id : undefined,
  }));
  w.ideas = w.inbox
    .filter((i) => i.type === "idea")
    .map((i) => ({
      ...entity(i.id, i.source, userId, i.createdAt),
      title: i.content,
      description: i.content,
      category: "Ideas",
      status: "captured",
      potential: "explore",
      projectIds: [],
      notes: "",
    }));
  // Old financial records were only Inbox text: preserve them without inventing amounts.
  w.incomes = w.projects
    .filter((p) => (p.paid ?? 0) > 0)
    .map((p) => ({
      ...entity("legacy-income-" + p.id, p.source, userId),
      title: "Cobro anterior · " + p.name,
      amount: p.paid ?? 0,
      currency: "USD",
      date: "2026-09-22",
      projectId: p.id,
      category: "Importado",
    }));
  validateWorkspace(w, userId);
  return w;
}
export class BrowserWorkspaceStorage implements WorkspaceStorage {
  constructor(
    private onWrite?: (userId: string, data: Workspace) => void,
  ) {}
  setOnWrite(onWrite?: (userId: string, data: Workspace) => void) {
    this.onWrite = onWrite;
  }
  read(userId: string) {
    const raw = window.localStorage.getItem("nexus-os-v02:" + userId);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      validateWorkspace(parsed, userId);
      return parsed;
    }
    if (userId === SYSTEM.localUserId) {
      const legacy = window.localStorage.getItem("nexus-os-v01");
      if (legacy) return migrateLegacy(JSON.parse(legacy), userId);
    }
    return null;
  }
  write(userId: string, data: Workspace) {
    window.localStorage.setItem("nexus-os-v02:" + userId, JSON.stringify(data));
    this.onWrite?.(userId, structuredClone(data));
  }
}
export class MemoryWorkspaceStorage implements WorkspaceStorage {
  private data = new Map<string, Workspace>();
  read(userId: string) {
    return structuredClone(this.data.get(userId) ?? null);
  }
  write(userId: string, data: Workspace) {
    this.data.set(userId, structuredClone(data));
  }
}
export function reassignWorkspaceUser(
  data: Workspace,
  userId: string,
  profile?: { displayName?: string | null; email?: string | null },
): Workspace {
  const next = structuredClone(data);
  const now = Date.now();
  const entities = [
    ...next.projects,
    ...next.inbox,
    ...next.ideas,
    ...next.events,
    ...next.flows,
    ...next.goals,
    ...next.incomes,
    ...next.expenses,
    ...next.financialGoals,
    ...next.contacts,
    ...next.knowledge,
    ...next.attachments,
    ...next.notifications,
    ...next.activity,
    ...next.messages,
    ...next.memories,
    ...next.aiUsage,
    ...next.dailyPlans,
    ...next.dependencies,
  ];
  for (const record of entities) {
    record.userId = userId;
    record.updatedAt = now;
  }
  for (const project of next.projects) {
    for (const task of project.tasks) {
      task.userId = userId;
      task.updatedAt = now;
    }
    for (const milestone of project.milestones) {
      milestone.userId = userId;
      milestone.updatedAt = now;
    }
  }
  for (const goal of next.goals) {
    for (const milestone of goal.milestones) {
      milestone.userId = userId;
      milestone.updatedAt = now;
    }
  }
  if (next.activeFlow) {
    next.activeFlow.userId = userId;
    next.activeFlow.updatedAt = now;
  }
  const name = profile?.displayName?.trim() || next.user.name || "Mi espacio";
  next.user = {
    ...next.user,
    id: userId,
    userId,
    source: "user",
    updatedAt: now,
    name,
    email: profile?.email ?? next.user.email,
    initials: name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase(),
  };
  validateWorkspace(next, userId);
  return next;
}

export class WorkspaceStore {
  private current: Workspace;
  private listeners = new Set<() => void>();
  private revision = 0;
  getRevision = () => this.revision;
  ready = false;
  error = "";
  constructor(
    private storage: WorkspaceStorage,
    readonly userId: string = SYSTEM.localUserId,
  ) {
    this.current = seedWorkspace();
    if (userId !== SYSTEM.localUserId) {
      for (const key of Object.keys(this.current) as (keyof Workspace)[]) {
        if (Array.isArray(this.current[key]))
          Object.assign(this.current, { [key]: [] });
      }
      this.current.user = {
        ...this.current.user,
        ...entity(userId, "user", userId),
        name: "Mi espacio",
        initials: "ME",
        email: "",
      };
    }
  }
  getSnapshot = () => this.current;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.revision++;
    this.listeners.forEach((l) => l());
  }
  load = () => {
    if (this.ready) return;
    try {
      this.current = this.storage.read(this.userId) ?? this.current;
      this.ready = true;
    } catch {
      this.error =
        "No se pudo leer tu espacio. Los datos originales siguen intactos. Revisa Data en System.";
    }
    this.emit();
  };
  update = (change: (draft: Workspace) => void) => {
    if (!this.ready)
      throw new Error(this.error || "NEXUS está cargando tu espacio.");
    const draft = structuredClone(this.current);
    change(draft);
    validateWorkspace(draft, this.userId);
    try {
      this.storage.write(this.userId, draft);
    } catch {
      this.error =
        "No se pudo guardar. Revisa el espacio o los permisos del navegador y vuelve a intentar.";
      this.emit();
      throw new Error(this.error);
    }
    this.error = "";
    this.current = draft;
    this.emit();
  };
  import = (data: unknown) => {
    validateWorkspace(data, this.userId);
    this.storage.write(this.userId, data);
    this.current = structuredClone(data);
    this.ready = true;
    this.error = "";
    this.emit();
  };
}
