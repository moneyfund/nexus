import type {
  Entity,
  Project,
  Task,
  Idea,
  Income,
  Expense,
  CalendarEvent,
  KnowledgeItem,
  Goal,
  Notification,
} from "@/domain/models";
import { WorkspaceStore } from "./workspace";
export interface Repository<T extends Entity> {
  list(userId: string): Promise<T[]>;
  get(userId: string, id: string): Promise<T | undefined>;
  save(userId: string, item: T): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
}
export type ProjectRepository = Repository<Project>;
export type TaskRepository = Repository<Task>;
export type IdeaRepository = Repository<Idea>;
export interface FinanceRepository {
  incomes: Repository<Income>;
  expenses: Repository<Expense>;
}
export type CalendarRepository = Repository<CalendarEvent>;
export type KnowledgeRepository = Repository<KnowledgeItem>;
export type GoalRepository = Repository<Goal>;
export type NotificationRepository = Repository<Notification>;
// A Firestore adapter must implement the same interfaces using users/{userId}/... .
// It is intentionally not registered until Auth, rules and credentials are configured.
type CollectionKey =
  | "projects"
  | "ideas"
  | "incomes"
  | "expenses"
  | "events"
  | "knowledge"
  | "goals"
  | "notifications";
export class LocalRepository<T extends Entity> implements Repository<T> {
  constructor(
    protected store: WorkspaceStore,
    private collection: CollectionKey,
  ) {}
  private authorize(userId: string) {
    if (userId !== this.store.userId) throw new Error("Perfil no autorizado.");
  }
  async list(userId: string): Promise<T[]> {
    this.authorize(userId);
    return structuredClone(
      this.store.getSnapshot()[this.collection],
    ) as unknown as T[];
  }
  async get(userId: string, id: string) {
    return (await this.list(userId)).find((i) => i.id === id);
  }
  async save(userId: string, item: T) {
    this.authorize(userId);
    if (item.userId !== userId) throw new Error("Propietario inválido.");
    this.store.update((w) => {
      const items = w[this.collection] as unknown as T[];
      const i = items.findIndex((x) => x.id === item.id);
      if (i < 0) items.push(item);
      else items[i] = { ...item, updatedAt: Date.now() };
    });
  }
  async remove(userId: string, id: string) {
    this.authorize(userId);
    this.store.update((w) => {
      const items = w[this.collection] as Entity[];
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    });
  }
}
export class LocalProjectRepository extends LocalRepository<Project> {
  constructor(store: WorkspaceStore) {
    super(store, "projects");
  }
}
export class LocalIdeaRepository extends LocalRepository<Idea> {
  constructor(store: WorkspaceStore) {
    super(store, "ideas");
  }
}
export class LocalTaskRepository implements TaskRepository {
  constructor(private store: WorkspaceStore) {}
  private authorize(userId: string) {
    if (userId !== this.store.userId) throw new Error("Perfil no autorizado.");
  }
  async list(userId: string) {
    this.authorize(userId);
    return structuredClone(
      this.store.getSnapshot().projects.flatMap((p) => p.tasks),
    );
  }
  async get(userId: string, id: string) {
    return (await this.list(userId)).find((t) => t.id === id);
  }
  async save(userId: string, task: Task) {
    this.authorize(userId);
    if (task.userId !== userId) throw new Error("Propietario inválido.");
    this.store.update((w) => {
      const p = w.projects.find((p) => p.id === task.projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      const i = p.tasks.findIndex((t) => t.id === task.id);
      if (i < 0) p.tasks.push(task);
      else p.tasks[i] = task;
    });
  }
  async remove(userId: string, id: string) {
    this.authorize(userId);
    this.store.update((w) => {
      w.projects.forEach((p) => {
        p.tasks = p.tasks.filter((t) => t.id !== id);
      });
    });
  }
}
export function createRepositories(store: WorkspaceStore) {
  return {
    projects: new LocalProjectRepository(store),
    tasks: new LocalTaskRepository(store),
    ideas: new LocalIdeaRepository(store),
    calendar: new LocalRepository<CalendarEvent>(store, "events"),
    knowledge: new LocalRepository<KnowledgeItem>(store, "knowledge"),
    goals: new LocalRepository<Goal>(store, "goals"),
    notifications: new LocalRepository<Notification>(store, "notifications"),
    finance: {
      incomes: new LocalRepository<Income>(store, "incomes"),
      expenses: new LocalRepository<Expense>(store, "expenses"),
    },
  };
}
