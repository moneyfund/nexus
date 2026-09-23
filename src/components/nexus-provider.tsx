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
  FirebaseStorageAdapter,
  startFirebaseWorkspaceSync,
} from "@/services/firebase-cloud";
import {
  initFirebaseAnalytics,
  observeFirebaseAuth,
  signInWithGoogle,
  signOutFirebase,
  type FirebaseUser,
} from "@/lib/firebase";
import { interfaceSound } from "@/services/sound";
import { SYSTEM } from "@/config/system";
import type { CaptureType, FlowSession, Workspace } from "@/domain/models";

type CloudStatus = "local" | "syncing" | "synced" | "error";

function useSystem() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("local");
  const [cloudError, setCloudError] = useState("");
  const [analyticsConnected, setAnalyticsConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = observeFirebaseAuth((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudStatus("local");
        setCloudError("");
      }
    });
    void initFirebaseAnalytics()
      .then(setAnalyticsConnected)
      .catch(() => setAnalyticsConnected(false));
    return unsubscribe;
  }, []);

  const userId = firebaseUser?.uid ?? SYSTEM.localUserId;
  const store = useMemo(
    () => new WorkspaceStore(new BrowserWorkspaceStorage(), userId),
    [userId],
  );

  useSyncExternalStore(store.subscribe, store.getRevision, () => 0);
  const data = store.getSnapshot();
  const ready = store.ready;
  const actions = useMemo(() => new NexusActions(store), [store]);
  const repositories = useMemo(() => createRepositories(store), [store]);
  const services = useMemo(
    () => ({
      ai: new MockAIProvider(),
      context: new NexusContextBuilder(),
      calendar: new MockCalendarProvider(repositories.calendar),
      storage: firebaseUser
        ? new FirebaseStorageAdapter()
        : new MockStorageProvider(),
      notifications: new LocalNotificationService(repositories.notifications),
    }),
    [repositories, firebaseUser],
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
    if (!firebaseUser || !ready) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    setCloudStatus("syncing");
    setCloudError("");

    void startFirebaseWorkspaceSync({
      user: firebaseUser,
      store,
      onStatus: (status) => {
        if (!cancelled) {
          setCloudStatus(status);
          if (status === "synced") setCloudError("");
        }
      },
      onError: (message) => {
        if (!cancelled) {
          setCloudStatus("error");
          setCloudError(message);
        }
      },
    })
      .then((stop) => {
        if (cancelled) stop();
        else cleanup = stop;
      })
      .catch((error) => {
        if (cancelled) return;
        setCloudStatus("error");
        setCloudError(
          error instanceof Error
            ? error.message
            : "No se pudo conectar NEXUS con Firestore.",
        );
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [firebaseUser, ready, store]);

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

  const connectFirebase = async () => {
    setCloudStatus("syncing");
    setCloudError("");
    try {
      const result = await signInWithGoogle();
      if (result) notify("Cuenta Google conectada. Sincronizando NEXUS…");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión con Google.";
      setCloudStatus("error");
      setCloudError(message);
      notify(message, true);
      throw error;
    }
  };

  const disconnectFirebase = async () => {
    try {
      await signOutFirebase();
      setCloudStatus("local");
      setCloudError("");
      notify("Sesión cerrada. NEXUS continúa disponible en este navegador.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cerrar la sesión.";
      notify(message, true);
      throw error;
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

  return {
    data,
    store,
    repositories,
    services,
    actions,
    ready,
    storageError: store.error,
    reduceMotion,
    firebaseUser,
    authReady,
    firebaseConnected: !!firebaseUser,
    cloudStatus,
    cloudError,
    analyticsConnected,
    connectFirebase,
    disconnectFirebase,
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
