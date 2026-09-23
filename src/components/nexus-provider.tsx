"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  NexusContextBuilder,
  LocalNotificationService,
} from "@/services/providers";
import { RestFirebaseStorageProvider } from "@/services/firebase-storage";
import { firebaseClient, type FirebaseSession } from "@/lib/firebase";
import { interfaceSound } from "@/services/sound";
import type { CaptureType, FlowSession, Workspace } from "@/domain/models";

function useSystem() {
  const [store] = useState(
    () => new WorkspaceStore(new BrowserWorkspaceStorage()),
  );
  useSyncExternalStore(store.subscribe, store.getRevision, () => 0);
  const data = store.getSnapshot();
  const actions = useMemo(() => new NexusActions(store), [store]);
  const repositories = useMemo(() => createRepositories(store), [store]);
  const services = useMemo(
    () => ({
      ai: new MockAIProvider(),
      context: new NexusContextBuilder(),
      calendar: new MockCalendarProvider(repositories.calendar),
      storage: new RestFirebaseStorageProvider(),
      notifications: new LocalNotificationService(repositories.notifications),
    }),
    [repositories],
  );

  const [session, setSession] = useState<FirebaseSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const hydrateCloud = async () => {
    setCloudReady(false);
    setCloudError("");
    const remote = await firebaseClient.readWorkspace();
    if (remote) store.import(remote);
    else await firebaseClient.writeWorkspace(store.getSnapshot());
    setCloudReady(true);
  };

  useEffect(() => {
    store.load();
    let active = true;
    firebaseClient
      .getSession()
      .then(async (saved) => {
        if (!active) return;
        setSession(saved);
        if (saved) await hydrateCloud();
      })
      .catch((error) => {
        if (active)
          setCloudError(
            error instanceof Error
              ? error.message
              : "No se pudo conectar con Firebase.",
          );
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    if (!session || !cloudReady || !store.ready) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      firebaseClient.writeWorkspace(store.getSnapshot()).catch((error) => {
        setCloudError(
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar con Firebase.",
        );
      });
    }, 550);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [data, session, cloudReady, store]);

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

  const signIn = async (email: string, password: string) => {
    const next = await firebaseClient.signIn(email, password);
    setSession(next);
    await hydrateCloud();
    notify("NEXUS conectado a Firebase.");
  };

  const signUp = async (email: string, password: string) => {
    const next = await firebaseClient.signUp(email, password);
    setSession(next);
    await hydrateCloud();
    notify("Cuenta creada y NEXUS sincronizado.");
  };

  const signOut = () => {
    firebaseClient.signOut();
    setSession(null);
    setCloudReady(false);
    notify("Sesión cerrada.");
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
    ready: store.ready,
    storageError: store.error || cloudError,
    reduceMotion,
    projects: data.projects,
    inbox: data.inbox,
    activeFlow: data.activeFlow,
    session,
    authReady,
    cloudReady,
    signIn,
    signUp,
    signOut,
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
