"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  executeMutation,
  executeQuery,
  getDataConnect,
  mutationRef,
  queryRef,
  type DataConnect,
} from "firebase/data-connect";
import { firebaseConfig, type FirebaseSession } from "@/lib/firebase";
import type { Workspace } from "@/domain/models";

const connectorConfig = {
  connector: "nexus",
  service: "nexus-core",
  location: "us-east4",
} as const;

let dataConnect: DataConnect | null = null;

async function getSqlConnect() {
  if (typeof window === "undefined")
    throw new Error("SQL Connect solo está disponible en el navegador.");

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // Initializing modular Auth causes Data Connect to attach the persisted
  // Firebase identity for this app. The existing compat login uses the same
  // project/API key and browser persistence.
  const auth = getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser)
    throw new Error("Inicia sesión en NEXUS antes de usar PostgreSQL.");

  if (!dataConnect) dataConnect = getDataConnect(app, connectorConfig);
  return dataConnect;
}

export interface SqlWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  kind: string;
  currency: string;
  timezone: string;
  role: string;
  status: string;
}

export async function getCurrentSqlUser() {
  const dc = await getSqlConnect();
  const result = await executeQuery(queryRef(dc, "GetCurrentUser"));
  return result.data as {
    appUser?: {
      uid: string;
      email: string;
      displayName?: string | null;
      photoUrl?: string | null;
      timezone: string;
    } | null;
  };
}

export async function getMySqlWorkspaces(): Promise<SqlWorkspaceSummary[]> {
  const dc = await getSqlConnect();
  const result = await executeQuery(queryRef(dc, "GetMyWorkspaces"));
  const data = result.data as {
    appUser?: {
      memberships?: Array<{
        role: string;
        status: string;
        workspace: Omit<SqlWorkspaceSummary, "role" | "status">;
      }>;
    } | null;
  };

  return (data.appUser?.memberships ?? []).map((membership) => ({
    ...membership.workspace,
    role: membership.role,
    status: membership.status,
  }));
}

export async function bootstrapPersonalSqlWorkspace(args: {
  session: FirebaseSession;
  timezone: string;
  preferences: unknown;
}) {
  const dc = await getSqlConnect();
  const existing = await getMySqlWorkspaces();
  const personal = existing.find(
    (membership) =>
      membership.kind === "personal" && membership.status === "active",
  );
  if (personal) return { created: false, workspace: personal };

  const slug =
    "personal-" +
    args.session.uid
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

  await executeMutation(
    mutationRef(dc, "BootstrapPersonalWorkspace", {
      email: args.session.email,
      displayName: args.session.displayName,
      photoUrl: args.session.photoURL,
      locale: "es-NI",
      timezone: args.timezone,
      preferences: args.preferences,
      workspaceName: "Personal",
      workspaceSlug: slug,
      legacyId: "personal:" + args.session.uid,
    }),
  );

  const after = await getMySqlWorkspaces();
  const workspace = after.find(
    (membership) =>
      membership.kind === "personal" && membership.status === "active",
  );
  if (!workspace)
    throw new Error("PostgreSQL no devolvió el workspace recién creado.");

  return { created: true, workspace };
}

export async function getSqlWorkspaceCore(args: {
  workspaceId: string;
  from: Date;
  to: Date;
}) {
  const dc = await getSqlConnect();
  const result = await executeQuery(
    queryRef(dc, "GetWorkspaceCore", {
      workspaceId: args.workspaceId,
      from: args.from.toISOString(),
      to: args.to.toISOString(),
    }),
  );
  return result.data;
}



interface SqlCoreTask {
  id: string;
  legacyId?: string | null;
  title: string;
  completed: boolean;
  estimatedMinutes: number;
  priority: string;
  sortOrder: number;
}

interface SqlCoreProject {
  id: string;
  legacyId?: string | null;
  progress: number;
  status: string;
  nextAction?: string | null;
  tasks?: SqlCoreTask[];
}

function minorUnits(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return String(Math.round(value * 100));
}

function sqlDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export interface SqlShadowSyncResult {
  projectsCreated: number;
  projectsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
}

export async function shadowSyncProjectsToSql(args: {
  workspace: Workspace;
  sqlWorkspaceId: string;
}): Promise<SqlShadowSyncResult> {
  const dc = await getSqlConnect();
  const coreResult = await executeQuery(
    queryRef(dc, "GetWorkspaceCore", {
      workspaceId: args.sqlWorkspaceId,
      from: "2000-01-01T00:00:00.000Z",
      to: "2100-01-01T00:00:00.000Z",
    }),
  );

  const core = coreResult.data as {
    appUser?: {
      memberships?: Array<{
        workspace?: {
          projects?: SqlCoreProject[];
        } | null;
      }>;
    } | null;
  };

  const remoteProjects =
    core.appUser?.memberships?.[0]?.workspace?.projects ?? [];
  const projectByLegacy = new Map(
    remoteProjects
      .filter((project) => project.legacyId)
      .map((project) => [project.legacyId as string, project]),
  );

  const result: SqlShadowSyncResult = {
    projectsCreated: 0,
    projectsUpdated: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
  };

  for (const project of args.workspace.projects) {
    let remote = projectByLegacy.get(project.id);

    if (!remote) {
      const inserted = await executeMutation(
        mutationRef(dc, "CreateProject", {
          workspaceId: args.sqlWorkspaceId,
          legacyId: project.id,
          name: project.name,
          area: project.area,
          clientName: project.client ?? null,
          description: project.description,
          progress: project.progress,
          status: project.status,
          priority: project.priority,
          stage: project.stage ?? null,
          deadline: sqlDate(project.dueDate),
          dueDate: sqlDate(project.dueDate),
          valueMinor: minorUnits(project.value),
          paidMinor: minorUnits(project.paid),
          currency: "USD",
          accent: project.accent,
          nextAction: project.nextAction,
          hours: project.hours,
          notes: project.notes ?? null,
          source: project.source,
          metadata: project.metadata ?? null,
        }),
      );
      const insertedData = inserted.data as {
        project_insert: { id: string };
      };
      remote = {
        id: insertedData.project_insert.id,
        legacyId: project.id,
        progress: project.progress,
        status: project.status,
        nextAction: project.nextAction,
        tasks: [],
      };
      projectByLegacy.set(project.id, remote);
      result.projectsCreated += 1;
    } else {
      await executeMutation(
        mutationRef(dc, "UpdateProjectProgress", {
          workspaceId: args.sqlWorkspaceId,
          projectId: remote.id,
          progress: project.progress,
          nextAction: project.nextAction,
          status: project.status,
        }),
      );
      result.projectsUpdated += 1;
    }

    const taskByLegacy = new Map(
      (remote.tasks ?? [])
        .filter((task) => task.legacyId)
        .map((task) => [task.legacyId as string, task]),
    );

    for (let index = 0; index < project.tasks.length; index += 1) {
      const task = project.tasks[index];
      let remoteTask = taskByLegacy.get(task.id);

      if (!remoteTask) {
        const inserted = await executeMutation(
          mutationRef(dc, "CreateTask", {
            workspaceId: args.sqlWorkspaceId,
            projectId: remote.id,
            legacyId: task.id,
            milestoneId: null,
            legacyMilestoneLabel: task.milestone,
            title: task.title,
            description: null,
            estimatedMinutes: task.estimatedMinutes,
            priority: task.priority,
            dueDate: null,
            sortOrder: index,
            source: task.source,
            metadata: task.metadata ?? null,
          }),
        );
        const insertedData = inserted.data as {
          task_insert: { id: string };
        };
        remoteTask = {
          id: insertedData.task_insert.id,
          legacyId: task.id,
          title: task.title,
          completed: false,
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority,
          sortOrder: index,
        };
        result.tasksCreated += 1;

        if (task.completed) {
          await executeMutation(
            mutationRef(dc, "SetTaskCompletion", {
              workspaceId: args.sqlWorkspaceId,
              taskId: remoteTask.id,
              completed: true,
            }),
          );
          remoteTask.completed = true;
        }
      } else {
        const detailsChanged =
          remoteTask.title !== task.title ||
          remoteTask.estimatedMinutes !== task.estimatedMinutes ||
          remoteTask.priority !== task.priority ||
          remoteTask.sortOrder !== index;

        if (detailsChanged) {
          await executeMutation(
            mutationRef(dc, "UpdateTask", {
              workspaceId: args.sqlWorkspaceId,
              taskId: remoteTask.id,
              title: task.title,
              description: null,
              estimatedMinutes: task.estimatedMinutes,
              priority: task.priority,
              dueDate: null,
              sortOrder: index,
            }),
          );
          result.tasksUpdated += 1;
        }

        if (remoteTask.completed !== task.completed) {
          await executeMutation(
            mutationRef(dc, "SetTaskCompletion", {
              workspaceId: args.sqlWorkspaceId,
              taskId: remoteTask.id,
              completed: task.completed,
            }),
          );
          result.tasksUpdated += 1;
        }
      }
    }
  }

  return result;
}


export const sqlConnectClient = {
  connectorConfig,
  getCurrentUser: getCurrentSqlUser,
  getMyWorkspaces: getMySqlWorkspaces,
  bootstrapPersonalWorkspace: bootstrapPersonalSqlWorkspace,
  getWorkspaceCore: getSqlWorkspaceCore,
  shadowSyncProjects: shadowSyncProjectsToSql,
};
