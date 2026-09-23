import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import type { FirebaseUser } from "@/lib/firebase";
import { firestore, firebaseStorage } from "@/lib/firebase";
import type {
  Attachment,
  Entity,
  Workspace,
} from "@/domain/models";
import { entity } from "@/domain/seed";
import {
  BrowserWorkspaceStorage,
  WorkspaceStore,
  validateWorkspace,
} from "@/repositories/workspace";
import type { StorageProvider } from "@/services/providers";
import { SYSTEM } from "@/config/system";

const SECTION_IDS = [
  "core",
  "projects",
  "ideas",
  "time",
  "goals",
  "finance",
  "knowledge",
  "system",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

type CloudSection = {
  data: Record<string, unknown>;
  clientId?: string;
  updatedAt?: { toMillis?: () => number };
};

function partitionWorkspace(workspace: Workspace): Record<SectionId, Record<string, unknown>> {
  return {
    core: {
      schemaVersion: workspace.schemaVersion,
      user: workspace.user,
      activeFlow: workspace.activeFlow,
    },
    projects: {
      projects: workspace.projects,
      dependencies: workspace.dependencies,
    },
    ideas: {
      inbox: workspace.inbox,
      ideas: workspace.ideas,
    },
    time: {
      events: workspace.events,
      flows: workspace.flows,
      dailyPlans: workspace.dailyPlans,
    },
    goals: {
      goals: workspace.goals,
    },
    finance: {
      incomes: workspace.incomes,
      expenses: workspace.expenses,
      financialGoals: workspace.financialGoals,
    },
    knowledge: {
      contacts: workspace.contacts,
      knowledge: workspace.knowledge,
      attachments: workspace.attachments,
    },
    system: {
      notifications: workspace.notifications,
      activity: workspace.activity,
      messages: workspace.messages,
      memories: workspace.memories,
      aiUsage: workspace.aiUsage,
    },
  };
}

function composeWorkspace(parts: Map<SectionId, Record<string, unknown>>): Workspace | null {
  if (SECTION_IDS.some((id) => !parts.has(id))) return null;
  const core = parts.get("core")!;
  const projects = parts.get("projects")!;
  const ideas = parts.get("ideas")!;
  const time = parts.get("time")!;
  const goals = parts.get("goals")!;
  const finance = parts.get("finance")!;
  const knowledge = parts.get("knowledge")!;
  const system = parts.get("system")!;

  return {
    schemaVersion: core.schemaVersion as Workspace["schemaVersion"],
    user: core.user as Workspace["user"],
    activeFlow: core.activeFlow as Workspace["activeFlow"],
    projects: projects.projects as Workspace["projects"],
    dependencies: projects.dependencies as Workspace["dependencies"],
    inbox: ideas.inbox as Workspace["inbox"],
    ideas: ideas.ideas as Workspace["ideas"],
    events: time.events as Workspace["events"],
    flows: time.flows as Workspace["flows"],
    dailyPlans: time.dailyPlans as Workspace["dailyPlans"],
    goals: goals.goals as Workspace["goals"],
    incomes: finance.incomes as Workspace["incomes"],
    expenses: finance.expenses as Workspace["expenses"],
    financialGoals: finance.financialGoals as Workspace["financialGoals"],
    contacts: knowledge.contacts as Workspace["contacts"],
    knowledge: knowledge.knowledge as Workspace["knowledge"],
    attachments: knowledge.attachments as Workspace["attachments"],
    notifications: system.notifications as Workspace["notifications"],
    activity: system.activity as Workspace["activity"],
    messages: system.messages as Workspace["messages"],
    memories: system.memories as Workspace["memories"],
    aiUsage: system.aiUsage as Workspace["aiUsage"],
  };
}

function reassignEntity<T extends Entity>(item: T, userId: string): T {
  return { ...item, userId };
}

export function reassignWorkspace(
  source: Workspace,
  user: FirebaseUser,
): Workspace {
  const userId = user.uid;
  const workspace = structuredClone(source);

  workspace.user = {
    ...workspace.user,
    id: userId,
    userId,
    source: "user",
    name: user.displayName?.trim() || workspace.user.name || "Mi espacio",
    email: user.email || workspace.user.email,
    initials:
      (user.displayName || workspace.user.name || "ME")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "ME",
    updatedAt: Date.now(),
  };

  const directCollections: (keyof Workspace)[] = [
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
  ];

  for (const key of directCollections) {
    const value = workspace[key];
    if (Array.isArray(value)) {
      (workspace as unknown as Record<string, unknown>)[key] = value.map((item) =>
        reassignEntity(item as Entity, userId),
      );
    }
  }

  workspace.projects = workspace.projects.map((project) => ({
    ...reassignEntity(project, userId),
    tasks: project.tasks.map((task) => reassignEntity(task, userId)),
    milestones: project.milestones.map((milestone) =>
      reassignEntity(milestone, userId),
    ),
  }));

  workspace.goals = workspace.goals.map((goal) => ({
    ...reassignEntity(goal, userId),
    milestones: goal.milestones.map((milestone) =>
      reassignEntity(milestone, userId),
    ),
  }));

  if (workspace.activeFlow) {
    workspace.activeFlow = reassignEntity(workspace.activeFlow, userId);
  }

  validateWorkspace(workspace, userId);
  return workspace;
}

async function writeCloudWorkspace(
  user: FirebaseUser,
  workspace: Workspace,
  clientId: string,
) {
  validateWorkspace(workspace, user.uid);
  const batch = writeBatch(firestore);
  const sections = partitionWorkspace(workspace);

  for (const id of SECTION_IDS) {
    batch.set(doc(firestore, "users", user.uid, "nexus", id), {
      data: sections[id],
      clientId,
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(
    doc(firestore, "users", user.uid),
    {
      displayName: user.displayName ?? workspace.user.name,
      email: user.email ?? workspace.user.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}

function sectionsFromSnapshot(
  docs: { id: string; data: () => DocumentData }[],
) {
  const parts = new Map<SectionId, Record<string, unknown>>();
  let sameClient = true;
  let newest = 0;
  let clientId = "";

  for (const snap of docs) {
    if (!SECTION_IDS.includes(snap.id as SectionId)) continue;
    const value = snap.data() as CloudSection;
    parts.set(snap.id as SectionId, value.data ?? {});
    const stamp = value.updatedAt?.toMillis?.() ?? 0;
    newest = Math.max(newest, stamp);
    if (!clientId) clientId = value.clientId ?? "";
    else if (clientId !== (value.clientId ?? "")) sameClient = false;
  }

  return {
    workspace: composeWorkspace(parts),
    clientId: sameClient ? clientId : "",
    updatedAt: newest,
  };
}

async function readCloudWorkspace(userId: string) {
  const snapshot = await getDocs(
    collection(firestore, "users", userId, "nexus"),
  );
  return sectionsFromSnapshot(snapshot.docs);
}

function readOriginalLocalWorkspace() {
  try {
    return new BrowserWorkspaceStorage().read(SYSTEM.localUserId);
  } catch {
    return null;
  }
}

export async function startFirebaseWorkspaceSync({
  user,
  store,
  onStatus,
  onError,
}: {
  user: FirebaseUser;
  store: WorkspaceStore;
  onStatus?: (status: "syncing" | "synced") => void;
  onError?: (message: string) => void;
}): Promise<() => void> {
  const clientId = crypto.randomUUID();
  let applyingRemote = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeStore: Unsubscribe | null = null;
  let unsubscribeRemote: Unsubscribe | null = null;

  onStatus?.("syncing");

  const remote = await readCloudWorkspace(user.uid);

  if (remote.workspace) {
    validateWorkspace(remote.workspace, user.uid);
    store.import(remote.workspace);
  } else {
    const original = readOriginalLocalWorkspace();
    if (original) {
      store.import(reassignWorkspace(original, user));
    } else {
      store.update((workspace) => {
        workspace.user.name =
          user.displayName?.trim() || workspace.user.name || "Mi espacio";
        workspace.user.email = user.email || workspace.user.email;
        workspace.user.initials =
          (user.displayName || workspace.user.name)
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "ME";
        workspace.user.updatedAt = Date.now();
      });
    }
    await writeCloudWorkspace(user, store.getSnapshot(), clientId);
  }

  if (disposed) return () => {};

  unsubscribeStore = store.subscribe(() => {
    if (!store.ready || applyingRemote || disposed) return;
    if (timer) clearTimeout(timer);
    onStatus?.("syncing");
    timer = setTimeout(() => {
      void writeCloudWorkspace(user, store.getSnapshot(), clientId)
        .then(() => onStatus?.("synced"))
        .catch((error) => {
          onError?.(
            error instanceof Error
              ? error.message
              : "No se pudo sincronizar con Firestore.",
          );
        });
    }, 650);
  });

  unsubscribeRemote = onSnapshot(
    collection(firestore, "users", user.uid, "nexus"),
    (snapshot) => {
      if (disposed || snapshot.empty) return;
      const cloud = sectionsFromSnapshot(snapshot.docs);
      if (!cloud.workspace) return;
      try {
        validateWorkspace(cloud.workspace, user.uid);
        const current = JSON.stringify(store.getSnapshot());
        const incoming = JSON.stringify(cloud.workspace);
        if (current === incoming || cloud.clientId === clientId) {
          onStatus?.("synced");
          return;
        }
        applyingRemote = true;
        store.import(cloud.workspace);
        applyingRemote = false;
        onStatus?.("synced");
      } catch (error) {
        applyingRemote = false;
        onError?.(
          error instanceof Error
            ? error.message
            : "Firestore devolvió un espacio no compatible.",
        );
      }
    },
    (error) => onError?.(error.message),
  );

  onStatus?.("synced");

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    unsubscribeStore?.();
    unsubscribeRemote?.();
  };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export class FirebaseStorageAdapter implements StorageProvider {
  async upload(userId: string, file: File): Promise<Attachment> {
    const id = crypto.randomUUID();
    const path = `users/${userId}/attachments/${id}/${safeFileName(file.name)}`;
    const fileRef = ref(firebaseStorage, path);
    await uploadBytes(fileRef, file, {
      contentType: file.type || "application/octet-stream",
    });
    return {
      ...entity(id, "user", userId),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      provider: "firebase",
      externalId: path,
    };
  }

  async getUrl(userId: string, attachment: Attachment) {
    if (
      attachment.provider !== "firebase" ||
      !attachment.externalId ||
      !attachment.externalId.startsWith(`users/${userId}/attachments/`)
    ) {
      return null;
    }
    return getDownloadURL(ref(firebaseStorage, attachment.externalId));
  }

  async remove(userId: string, id: string) {
    if (!id.startsWith(`users/${userId}/attachments/`)) {
      throw new Error("Archivo fuera del espacio del usuario.");
    }
    await deleteObject(ref(firebaseStorage, id));
  }
}
