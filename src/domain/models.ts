export type ID = string;
export type Provenance = "demo" | "user";
export interface Entity {
  id: ID;
  userId: ID;
  createdAt: number;
  updatedAt: number;
  source: Provenance;
  metadata?: Record<string, string | number | boolean>;
}
export type ProjectStatus = "active" | "waiting" | "backlog" | "completed";
export type Priority = "critical" | "high" | "medium" | "low";
export type ProjectStage = "discovery" | "planning" | "execution" | "delivery";
export interface Task extends Entity {
  projectId: ID;
  title: string;
  completed: boolean;
  estimatedMinutes: number;
  priority: Priority;
  milestone: string;
  completedAt?: number;
}
export interface TaskDependency extends Entity {
  taskId: ID;
  dependsOnTaskId: ID;
}
export interface Milestone extends Entity {
  projectId: ID;
  title: string;
  weight: number;
  progress: number;
  baselineProgress?: number;
}
export interface Project extends Entity {
  name: string;
  area: string;
  client?: string;
  description: string;
  progress: number;
  status: ProjectStatus;
  priority: Priority;
  deadline: string;
  dueDate?: string;
  value?: number;
  paid?: number;
  accent: string;
  milestones: Milestone[];
  tasks: Task[];
  nextAction: string;
  hours: number;
  stage?: ProjectStage;
  notes?: string;
  dependsOn?: ID[];
  contactIds?: ID[];
}
export type CaptureType =
  | "idea"
  | "task"
  | "note"
  | "project"
  | "income"
  | "expense"
  | "contact"
  | "file"
  | "link";
export interface InboxItem extends Entity {
  type: CaptureType;
  content: string;
  targetId?: ID;
  processed?: boolean;
}
export interface Idea extends Entity {
  title: string;
  category: string;
  description: string;
  status: "captured" | "review" | "converted" | "archived";
  potential: "explore" | "promising" | "high";
  projectIds: ID[];
  notes: string;
  reviewDate?: string;
}
export interface Opportunity extends Entity {
  ideaId: ID;
  title: string;
  estimatedValue?: number;
  status: "exploring" | "qualified" | "closed";
}
export interface FlowSession extends Entity {
  projectId: ID;
  taskId: ID;
  title: string;
  projectName: string;
  durationMinutes: number;
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
  endedAt?: number;
  elapsedSeconds?: number;
  completed?: boolean;
}
export type TimeCategory =
  | "focus"
  | "meeting"
  | "admin"
  | "client"
  | "university"
  | "personal"
  | "deadline";
export interface CalendarEvent extends Entity {
  title: string;
  start: string;
  end: string;
  category: TimeCategory;
  projectId?: ID;
  description?: string;
  providerId?: string;
}
export type TimeBlock = CalendarEvent;
export interface DailyBlock {
  time: string;
  end: string;
  projectId: string;
  title: string;
  type: "focus" | "admin" | "meeting";
}
export interface DailyPlan extends Entity {
  date: string;
  outcomeTaskIds: ID[];
  directiveProjectId?: ID;
}
export interface GoalMilestone extends Entity {
  goalId: ID;
  title: string;
  completed: boolean;
}
export interface Goal extends Entity {
  title: string;
  targetDate: string;
  projectIds: ID[];
  milestones: GoalMilestone[];
}
export interface MoneyRecord extends Entity {
  title: string;
  amount: number;
  currency: "USD";
  date: string;
  projectId?: ID;
  category: string;
}
export type Income = MoneyRecord;
export type Expense = MoneyRecord;
export interface Receivable extends Entity {
  projectId: ID;
  amount: number;
  dueDate?: string;
  currency: "USD";
}
export interface FinancialGoal extends Entity {
  title: string;
  target: number;
  saved: number;
  kind: "savings" | "investment";
}
export interface Contact extends Entity {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}
export interface Client extends Contact {
  projectIds: ID[];
}
export type KnowledgeType =
  "note" | "document" | "pdf" | "link" | "research" | "memory";
export interface KnowledgeItem extends Entity {
  title: string;
  type: KnowledgeType;
  content: string;
  url?: string;
  projectId?: ID;
  category: string;
  tags: string[];
  attachmentId?: ID;
}
export interface Attachment extends Entity {
  name: string;
  mimeType: string;
  size: number;
  provider: "mock" | "drive" | "firebase";
  externalId?: ID;
  projectId?: ID;
}
export type NotificationKind =
  | "deadline"
  | "calendar"
  | "overdue"
  | "receivable"
  | "inactivity"
  | "flow"
  | "goal"
  | "ai";
export interface Notification extends Entity {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  read: boolean;
}
export interface ActivityEvent extends Entity {
  projectId?: ID;
  kind: string;
  title: string;
}
export interface AIConversation extends Entity {
  title: string;
  messageIds: ID[];
}
export interface AIMessage extends Entity {
  conversationId: ID;
  role: "user" | "assistant";
  content: string;
  contextIds: ID[];
  simulated: boolean;
}
export interface AIMemory extends Entity {
  content: string;
  projectIds: ID[];
}
export interface AIUsage extends Entity {
  provider: "mock" | "openai";
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}
export interface UserPreferences {
  motion: "full" | "reduced" | "off";
  quality: "auto" | "low" | "high";
  sounds: boolean;
  notifications: boolean;
  timezone: string;
  accent: "fuchsia" | "violet";
  aiContext: {
    projects: boolean;
    calendar: boolean;
    finance: boolean;
    knowledge: boolean;
  };
}
export interface User extends Entity {
  name: string;
  email: string;
  initials: string;
  preferences: UserPreferences;
}
export interface Session {
  userId: ID;
  mode: "local" | "firebase";
  authenticated: boolean;
}
export interface Workspace {
  schemaVersion: 2;
  user: User;
  projects: Project[];
  inbox: InboxItem[];
  ideas: Idea[];
  events: CalendarEvent[];
  flows: FlowSession[];
  activeFlow: FlowSession | null;
  goals: Goal[];
  incomes: Income[];
  expenses: Expense[];
  financialGoals: FinancialGoal[];
  contacts: Contact[];
  knowledge: KnowledgeItem[];
  attachments: Attachment[];
  notifications: Notification[];
  activity: ActivityEvent[];
  messages: AIMessage[];
  memories: AIMemory[];
  aiUsage: AIUsage[];
  dailyPlans: DailyPlan[];
  dependencies: TaskDependency[];
}
export interface CaptureInput {
  type: CaptureType;
  content: string;
  projectId?: ID;
  category?: string;
  amount?: number;
  url?: string;
  file?: { name: string; size: number; type: string };
}
