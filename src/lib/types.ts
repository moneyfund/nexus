export type ProjectStatus = "active" | "waiting" | "backlog" | "completed";
export type Priority = "critical" | "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes: number;
  priority: Priority;
  milestone: string;
}

export interface Milestone {
  id: string;
  title: string;
  weight: number;
  progress: number;
}

export interface Project {
  id: string;
  name: string;
  area: string;
  client?: string;
  description: string;
  progress: number;
  status: ProjectStatus;
  priority: Priority;
  deadline: string;
  value?: number;
  paid?: number;
  accent: string;
  milestones: Milestone[];
  tasks: Task[];
  nextAction: string;
  hours: number;
}

export interface InboxItem {
  id: string;
  type: "idea" | "task" | "note" | "income" | "expense";
  content: string;
  createdAt: number;
}

export interface FlowSession {
  projectId: string;
  taskId: string;
  title: string;
  projectName: string;
  durationMinutes: number;
  startedAt: number;
}

export interface DailyBlock {
  time: string;
  end: string;
  projectId: string;
  title: string;
  type: "focus" | "admin" | "meeting";
}
