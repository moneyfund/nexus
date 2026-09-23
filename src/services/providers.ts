import type {
  Attachment,
  CalendarEvent,
  Session,
  User,
  Workspace,
  AIMessage,
  Notification,
} from "@/domain/models";
import type {
  CalendarRepository,
  NotificationRepository,
} from "@/repositories/contracts";
import { entity } from "@/domain/seed";
import { analytics, projectFinance } from "@/domain/selectors";
import { googleWorkspaceClient } from "@/lib/google-workspace";
export class IntegrationNotConnectedError extends Error {
  constructor(service: string) {
    super(service + " todavía no está conectado.");
  }
}
export interface AuthProvider {
  getSession(): Promise<Session>;
  signInWithGoogle(): Promise<Session>;
  signOut(): Promise<void>;
  getProfile(userId: string): Promise<User>;
}
export abstract class FirebaseAuthProvider implements AuthProvider {
  abstract getSession(): Promise<Session>;
  abstract signInWithGoogle(): Promise<Session>;
  abstract signOut(): Promise<void>;
  abstract getProfile(userId: string): Promise<User>;
}
export interface CalendarProvider {
  getEvents(userId: string, from: string, to: string): Promise<CalendarEvent[]>;
  createEvent(userId: string, event: CalendarEvent): Promise<void>;
  updateEvent(userId: string, event: CalendarEvent): Promise<void>;
  deleteEvent(userId: string, id: string): Promise<void>;
  findAvailability(
    userId: string,
    from: string,
    to: string,
    minutes: number,
  ): Promise<{ start: string; end: string }[]>;
  scheduleFocusBlock(userId: string, event: CalendarEvent): Promise<void>;
}
export class MockCalendarProvider implements CalendarProvider {
  constructor(private repository: CalendarRepository) {}
  async getEvents(userId: string, from: string, to: string) {
    return (await this.repository.list(userId)).filter(
      (e) =>
        new Date(e.start) < new Date(to) && new Date(e.end) > new Date(from),
    );
  }
  async createEvent(userId: string, event: CalendarEvent) {
    if (new Date(event.end) <= new Date(event.start))
      throw new Error("El bloque debe terminar después de iniciar.");
    await this.repository.save(userId, event);
  }
  updateEvent = this.createEvent;
  async deleteEvent(userId: string, id: string) {
    await this.repository.remove(userId, id);
  }
  async findAvailability(
    userId: string,
    from: string,
    to: string,
    minutes: number,
  ) {
    if (minutes <= 0) return [];
    const events = await this.getEvents(userId, from, to);
    const slots = [];
    for (
      let t = +new Date(from);
      t + minutes * 60000 <= +new Date(to);
      t += 15 * 60000
    ) {
      const end = t + minutes * 60000;
      if (!events.some((e) => +new Date(e.start) < end && +new Date(e.end) > t))
        slots.push({
          start: new Date(t).toISOString(),
          end: new Date(end).toISOString(),
        });
    }
    return slots;
  }
  async scheduleFocusBlock(userId: string, event: CalendarEvent) {
    return this.createEvent(userId, { ...event, category: "focus" });
  }
}
export class GoogleCalendarProvider implements CalendarProvider {
  private local: MockCalendarProvider;

  constructor(
    private repository: CalendarRepository,
    private getAccessToken: () => string | null,
  ) {
    this.local = new MockCalendarProvider(repository);
  }

  get connected() {
    return !!this.getAccessToken();
  }

  async getEvents(userId: string, from: string, to: string) {
    return this.local.getEvents(userId, from, to);
  }

  async sync(userId: string, from: string, to: string) {
    const token = this.getAccessToken();
    if (!token)
      throw new IntegrationNotConnectedError("Google Calendar");
    const remote = await googleWorkspaceClient.listCalendarEvents(
      token,
      userId,
      from,
      to,
    );
    for (const event of remote)
      await this.repository.save(userId, event);
    return remote;
  }

  async createEvent(userId: string, event: CalendarEvent) {
    if (new Date(event.end) <= new Date(event.start))
      throw new Error("El bloque debe terminar después de iniciar.");
    const token = this.getAccessToken();
    const saved = token
      ? await googleWorkspaceClient.createCalendarEvent(token, event)
      : event;
    await this.repository.save(userId, saved);
  }

  async updateEvent(userId: string, event: CalendarEvent) {
    const token = this.getAccessToken();
    const saved = token
      ? await googleWorkspaceClient.updateCalendarEvent(token, event)
      : event;
    await this.repository.save(userId, saved);
  }

  async deleteEvent(userId: string, id: string) {
    const event = await this.repository.get(userId, id);
    const token = this.getAccessToken();
    if (token && event?.providerId)
      await googleWorkspaceClient.deleteCalendarEvent(token, event.providerId);
    await this.repository.remove(userId, id);
  }

  async findAvailability(
    userId: string,
    from: string,
    to: string,
    minutes: number,
  ) {
    return this.local.findAvailability(userId, from, to, minutes);
  }

  async scheduleFocusBlock(userId: string, event: CalendarEvent) {
    return this.createEvent(userId, { ...event, category: "focus" });
  }
}
export interface StorageProvider {
  upload(userId: string, file: File): Promise<Attachment>;
  getUrl(userId: string, attachment: Attachment): Promise<string | null>;
  remove(userId: string, id: string): Promise<void>;
}
export class MockStorageProvider implements StorageProvider {
  async upload(userId: string, file: File): Promise<Attachment> {
    return {
      ...entity(crypto.randomUUID(), "user", userId),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      provider: "mock",
    };
  }
  async getUrl() {
    return null;
  }
  async remove() {}
}
export abstract class DriveStorageProvider implements StorageProvider {
  abstract upload: StorageProvider["upload"];
  abstract getUrl: StorageProvider["getUrl"];
  abstract remove: StorageProvider["remove"];
}
export abstract class FirebaseStorageProvider implements StorageProvider {
  abstract upload: StorageProvider["upload"];
  abstract getUrl: StorageProvider["getUrl"];
  abstract remove: StorageProvider["remove"];
}
export interface NotificationService {
  list(userId: string): Promise<Notification[]>;
  markRead(userId: string, id: string): Promise<void>;
}
export class LocalNotificationService implements NotificationService {
  constructor(private repo: NotificationRepository) {}
  list(userId: string) {
    return this.repo.list(userId);
  }
  async markRead(userId: string, id: string) {
    const n = await this.repo.get(userId, id);
    if (n) await this.repo.save(userId, { ...n, read: true });
  }
}
export interface NexusContext {
  userId: string;
  projects: Array<{
    id: string;
    name: string;
    area: string;
    priority: Workspace["projects"][number]["priority"];
    nextAction: string;
    status: Workspace["projects"][number]["status"];
    dueDate?: string;
    progress: number;
    value?: number;
    tasks: Array<{
      id: string;
      title: string;
      completed: boolean;
      milestone: string;
      priority: Workspace["projects"][number]["tasks"][number]["priority"];
    }>;
  }>;
  events: CalendarEvent[];
  finance: Array<{
    projectId: string;
    value?: number;
    paid: number;
    expenses: number;
    receivable: number;
  }>;
  knowledge: Array<{
    id: string;
    title: string;
    category: string;
    tags: string[];
  }>;
  memories: Array<{ id: string; content: string; projectIds: string[] }>;
}
export class NexusContextBuilder {
  build(w: Workspace): NexusContext {
    const c = w.user.preferences.aiContext;
    return {
      userId: w.user.id,
      projects: c.projects
        ? w.projects.map((project) => ({
            id: project.id,
            name: project.name,
            area: project.area,
            priority: project.priority,
            nextAction: project.nextAction,
            status: project.status,
            dueDate: project.dueDate,
            progress: project.progress,
            value: project.value,
            tasks: project.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              completed: task.completed,
              milestone: task.milestone,
              priority: task.priority,
            })),
          }))
        : [],
      events: c.calendar ? w.events : [],
      finance: c.finance
        ? w.projects.map((project) => {
            const finance = projectFinance(w, project);
            return {
              projectId: project.id,
              value: project.value,
              paid: finance.paid,
              expenses: finance.expenses,
              receivable: finance.receivable,
            };
          })
        : [],
      knowledge: c.knowledge
        ? w.knowledge.map(({ id, title, category, tags }) => ({
            id,
            title,
            category,
            tags,
          }))
        : [],
      memories: c.knowledge
        ? w.memories.map(({ id, content, projectIds }) => ({
            id,
            content,
            projectIds,
          }))
        : [],
    };
  }
}
export class NexusToolRegistry {
  readonly tools = [
    { id: "projects.read", label: "Consultar proyectos", access: "read" },
    { id: "calendar.read", label: "Consultar calendario", access: "read" },
    { id: "finance.read", label: "Consultar finanzas", access: "read" },
    { id: "task.propose", label: "Proponer una tarea", access: "confirm" },
    { id: "task.complete", label: "Completar tarea", access: "confirm" },
    { id: "finance.write", label: "Registrar movimiento", access: "confirm" },
    { id: "project.update", label: "Actualizar proyecto", access: "confirm" },
  ];
}
export interface AIProvider {
  respond(
    prompt: string,
    context: NexusContext,
    signal?: AbortSignal,
  ): Promise<AIMessage>;
}
export class MockAIProvider implements AIProvider {
  async respond(
    prompt: string,
    context: NexusContext,
    signal?: AbortSignal,
  ): Promise<AIMessage> {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const priority = { critical: 0, high: 1, medium: 2, low: 3 };
    const active = context.projects
      .filter((p) => p.status === "active")
      .sort((a, b) => priority[a.priority] - priority[b.priority]);
    const first = active[0];
    const content = /finanz|cobr|dinero|ingreso/i.test(prompt)
      ? context.finance.length
        ? "Saldos registrados: " +
          context.finance
            .filter((p) => p.receivable > 0)
            .map(
              (p) =>
                `${context.projects.find((x) => x.id === p.projectId)?.name ?? p.projectId}: $${p.receivable}`,
            )
            .join(", ") +
          ". Revisa Finance antes de planificar cobros."
        : "El contexto financiero está desactivado. Puedes habilitarlo en System → AI."
      : first
        ? `Tu siguiente frente es ${first.name}.\n\n${first.nextAction}.\n\nReserva un bloque sin interrupciones y define un resultado verificable. ${active[1] ? `Después, revisa ${active[1].name}.` : ""}\n\nHay ${context.events.length} bloques disponibles en el contexto. Esta sugerencia es una simulación determinista basada en la prioridad registrada; no estima carga ni impacto financiero.`
        : "No tengo proyectos activos en el contexto. Revisa los permisos de contexto o activa un proyecto para preparar tu siguiente acción.";
    return {
      ...entity(crypto.randomUUID(), "user", context.userId),
      conversationId: "local-conversation",
      role: "assistant",
      content,
      contextIds: [
        ...context.projects.map((p) => p.id),
        ...context.events.map((e) => e.id),
        ...context.knowledge.map((k) => k.id),
      ],
      simulated: true,
    };
  }
}
export abstract class OpenAIProvider implements AIProvider {
  abstract respond: AIProvider["respond"];
}
export class AIUsageTracker {
  summarize(w: Workspace) {
    return {
      calls: w.aiUsage.length,
      costUSD: w.aiUsage.reduce((s, u) => s + u.costUSD, 0),
      execution: analytics(w).score,
    };
  }
}
