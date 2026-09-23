"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import {
  BrowserWorkspaceStorage,
  WorkspaceStore,
  reassignWorkspaceUser,
} from "@/repositories/workspace";
import { createRepositories } from "@/repositories/contracts";
import { NexusActions } from "@/services/actions";
import {
  MockAIProvider,
  MockCalendarProvider,
  MockStorageProvider,
  NexusContextBuilder,
  LocalNotificationService,
} from "@/services/providers";
import {
  FirebaseFileStorageService,
  loadWorkspaceFromCloud,
  observeFirebaseAuth,
  queueWorkspaceCloudSave,
  signInWithGoogle,
  signOutFirebase,
  type FirebaseUserProfile,
} from "@/lib/firebase-client";
import { interfaceSound } from "@/services/sound";
import { SYSTEM } from "@/config/system";
import type { CaptureType, FlowSession, Workspace } from "@/domain/models";

type CloudStatus = "local" | "loading" | "syncing" | "synced" | "error";

function useFirebaseSession() {
  const [user, setUser] = useState<FirebaseUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    observeFirebaseAuth(
      (next) => {
        if (disposed) return;
        setUser(next);
        setError("");
        setLoading(false);
      },
      (message) => {
        if (disposed) return;
        setError(message);
        setLoading(false);
      },
    )
      .then((off) => {
        if (disposed) off();
        else unsubscribe = off;
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo inicializar Firebase Auth.",
        );
        setLoading(false);
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  return {
    user,
    loading,
    error,
    signIn: signInWithGoogle,
    signOut: signOutFirebase,
  };
}

async function hydrateAuthenticatedWorkspace(
  store: WorkspaceStore,
  user: FirebaseUserProfile,
) {
  const cloud = await loadWorkspaceFromCloud(user.uid);
  if (cloud) {
    store.import(
      reassignWorkspaceUser(cloud, user.uid, {
        displayName: user.displayName,
        email: user.email,
      }),
    );
    return "cloud" as const;
  }

  const browser = new BrowserWorkspaceStorage();
  const existing = browser.read(user.uid);
  const local = existing ?? browser.read(SYSTEM.localUserId);
  const migrated = reassignWorkspaceUser(
    local ?? store.getSnapshot(),
    user.uid,
    {
      displayName: user.displayName,
      email: user.email,
    },
  );
  store.import(migrated);
  await queueWorkspaceCloudSave(user.uid, migrated);
  return existing ? ("device" as const) : ("migrated" as const);
}

function useSystem() {
  const auth = useFirebaseSession();
  const [store, setStore] = useState(
    () => new WorkspaceStore(new BrowserWorkspaceStorage()),
  );
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("local");
  const [cloudError, setCloudError] = useState("");

  useSyncExternalStore(store.subscribe, store.getRevision, () => 0);
  const data = store.getSnapshot();
  const actions = useMemo(() => new NexusActions(store), [store]);
  const repositories = useMemo(() => createRepositories(store), [store]);
  const services = useMemo(
    () => ({
      ai: new MockAIProvider(),
      context: new NexusContextBuilder(),
      calendar: new MockCalendarProvider(repositories.calendar),
      storage: auth.user
        ? new FirebaseFileStorageService()
        : new MockStorageProvider(),
      notifications: new LocalNotificationService(repositories.notifications),
    }),
    [repositories, auth.user],
  );

  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureType, setCaptureType] = useState<CaptureType>("idea");
  const [captureProject, setCaptureProject] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [flowResult, setFlowResult] = useState<FlowSession | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const osReduced = useReducedMotion();
  const reduceMotion = !!osReduced || data.user.preferences.motion !== "full";

  useEffect(() => {
    store.load();
  }, [store]);

  useEffect(() => {
    if (auth.loading) return;

    let cancelled = false;
    const userId = auth.user?.uid ?? SYSTEM.localUserId;
    const storage = new BrowserWorkspaceStorage();
    const nextStore = new WorkspaceStore(storage, userId);
    nextStore.load();
    setStore(nextStore);

    if (!auth.user) {
      setCloudStatus("local");
      setCloudError("");
      return;
    }

    const user = auth.user;
    setCloudStatus("loading");
    setCloudError("");

    void hydrateAuthenticatedWorkspace(nextStore, user)
      .then(() => {
        if (cancelled) return;
        storage.setOnWrite((uid, workspace) => {
          if (uid !== user.uid) return;
          setCloudStatus("syncing");
          setCloudError("");
          void queueWorkspaceCloudSave(uid, workspace)
            .then(() => {
              if (!cancelled) setCloudStatus("synced");
            })
            .catch((cause: unknown) => {
              if (cancelled) return;
              setCloudStatus("error");
              setCloudError(
                cause instanceof Error
                  ? cause.message
                  : "No se pudo sincronizar con Firestore.",
              );
            });
        });
        setCloudStatus("synced");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setCloudStatus("error");
        setCloudError(
          cause instanceof Error
            ? cause.message
            : "No se pudo cargar el espacio desde Firestore.",
        );
      });

    return () => {
      cancelled = true;
      storage.setOnWrite(undefined);
    };
  }, [auth.loading, auth.user?.uid]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
    document.documentElement.dataset.accent = data.user.preferences.accent;
  }, [reduceMotion, data.user.preferences.accent]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.error ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (message: string, error = false) =>
    setToast({ message, error });

  const run = <T,>(action: () => T, message?: string): T | undefined => {
    try {
      const result = action();
      if (message) notify(message);
      return result;
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
        true,
      );
      return undefined;
    }
  };

  const openCapture = (type: CaptureType = "idea", projectId = "") => {
    setCaptureType(type);
    setCaptureProject(projectId);
    setCaptureOpen(true);
  };

  const startFlow = (projectId: string, taskId: string, duration?: number) =>
    run(() => {
      actions.startFlow(projectId, taskId, duration);
      interfaceSound(data.user.preferences.sounds, "flow");
    });

  const endFlow = (completeTask = false) =>
    run(() => {
      const result = actions.endFlow(completeTask);
      setFlowResult(result);
      interfaceSound(data.user.preferences.sounds, "complete");
    });

  const connectGoogle = async () => {
    try {
      await auth.signIn();
      notify("Sesión de Google conectada.");
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "No se pudo iniciar sesión con Google.",
        true,
      );
    }
  };

  const disconnectGoogle = async () => {
    try {
      await auth.signOut();
      notify("Sesión cerrada. NEXUS volvió al espacio local.");
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "No se pudo cerrar la sesión.",
        true,
      );
    }
  };

  return {
    data,
    store,
    repositories,
    services,
    actions,
    ready: store.ready,
    storageError: store.error,
    reduceMotion,
    projects: data.projects,
    inbox: data.inbox,
    activeFlow: data.activeFlow,
    captureOpen,
    setCaptureOpen,
    captureType,
    captureProject,
    openCapture,
    commandOpen,
    setCommandOpen,
    notificationOpen,
    setNotificationOpen,
    selectedIdeaId,
    setSelectedIdeaId,
    flowResult,
    setFlowResult,
    toast,
    setToast,
    notify,
    run,
    startFlow,
    endFlow,
    authUser: auth.user,
    authLoading: auth.loading,
    authError: auth.error,
    cloudStatus,
    cloudError,
    connectGoogle,
    disconnectGoogle,
    toggleTask: (projectId: string, taskId: string) =>
      run(() => actions.toggleTask(projectId, taskId)),
    capture: (type: CaptureType, content: string) =>
      run(() => actions.capture({ type, content })),
    update: (fn: (draft: Workspace) => void) =>
      run(() => {
        store.update(fn);
        return true;
      }) === true,
  };
}

const NexusContext = createContext<ReturnType<typeof useSystem> | null>(null);

export function NexusProvider({ children }: { children: ReactNode }) {
  const system = useSystem();
  return (
    <NexusContext.Provider value={system}>
      <MotionConfig reducedMotion={system.reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </NexusContext.Provider>
  );
}

export function useNexus() {
  const value = useContext(NexusContext);
  if (!value) throw new Error("useNexus must be used inside NexusProvider");
  return value;
}
