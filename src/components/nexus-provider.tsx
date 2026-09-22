"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialProjects } from "@/lib/mock-data";
import type { FlowSession, InboxItem, Project } from "@/lib/types";

type CaptureType = InboxItem["type"];

interface NexusContextValue {
  projects: Project[];
  inbox: InboxItem[];
  activeFlow: FlowSession | null;
  captureOpen: boolean;
  setCaptureOpen: (value: boolean) => void;
  capture: (type: CaptureType, content: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  startFlow: (projectId: string, taskId: string, duration?: number) => void;
  endFlow: (completeTask?: boolean) => void;
}

const NexusContext = createContext<NexusContextValue | null>(null);
const STORAGE_KEY = "nexus-os-v01";

export function NexusProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [inbox, setInbox] = useState<InboxItem[]>([
    { id: "seed-1", type: "idea", content: "Sistema automático de presupuestos de construcción", createdAt: Date.now() - 5400000 }
  ]);
  const [activeFlow, setActiveFlow] = useState<FlowSession | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { projects?: Project[]; inbox?: InboxItem[] };
        if (parsed.projects) setProjects(parsed.projects);
        if (parsed.inbox) setInbox(parsed.inbox);
      }
    } catch {
      // Fallback to seeded state.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, inbox }));
  }, [projects, inbox, hydrated]);

  const capture = (type: CaptureType, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setInbox((current) => [
      { id: crypto.randomUUID(), type, content: trimmed, createdAt: Date.now() },
      ...current
    ]);
    setCaptureOpen(false);
  };

  const toggleTask = (projectId: string, taskId: string) => {
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const tasks = project.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        );
        const completed = tasks.filter((task) => task.completed).length;
        const taskProgress = tasks.length ? Math.round((completed / tasks.length) * 100) : project.progress;
        return { ...project, tasks, progress: Math.max(project.progress, taskProgress) };
      })
    );
  };

  const startFlow = (projectId: string, taskId: string, duration?: number) => {
    const project = projects.find((item) => item.id === projectId);
    const task = project?.tasks.find((item) => item.id === taskId);
    if (!project || !task) return;
    setActiveFlow({
      projectId,
      taskId,
      title: task.title,
      projectName: project.name,
      durationMinutes: duration ?? task.estimatedMinutes,
      startedAt: Date.now()
    });
  };

  const endFlow = (completeTask = false) => {
    if (completeTask && activeFlow) toggleTask(activeFlow.projectId, activeFlow.taskId);
    setActiveFlow(null);
  };

  const value = useMemo(
    () => ({ projects, inbox, activeFlow, captureOpen, setCaptureOpen, capture, toggleTask, startFlow, endFlow }),
    [projects, inbox, activeFlow, captureOpen]
  );

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus() {
  const value = useContext(NexusContext);
  if (!value) throw new Error("useNexus must be used inside NexusProvider");
  return value;
}
