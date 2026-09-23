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
  reassignWorkspaceUser,
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
import { SYSTEM } from "@/config/system";
import type { CaptureType, FlowSession, Workspace } from "@/domain/models";

function buildUserStore(session: FirebaseSession) {
  const storage = new BrowserWorkspaceStorage();
  const store = new WorkspaceStore(storage, session.uid);
  store.load();
  return store;
}

function readLocalMigrationSource() {
  try {
    return new BrowserWorkspaceStorage().read(SYSTEM.localUserId);
  } catch {
    return null;
  }
}

async function hydrateAuthenticatedStore(
  store: WorkspaceStore,
  session: FirebaseSession,
) {
  const remote = await firebaseClient.readWorkspace();

  if (remote) {
    const normalized = reassignWorkspaceUser(remote, session.uid, {
      displayName: session.displayName,
      email: session.email,
    });
    store.import(normalized);

    if (remote.user?.id !== session.uid)
      await firebaseClient.writeWorkspace(normalized);

    return;
  }

  const userLocal = new BrowserWorkspaceStorage().read(session.uid);
  const previousLocal = readLocalMigrationSource();
  const source = userLocal ?? previousLocal ?? store.getSnapshot();
  const normalized = reassignWorkspaceUser(source, session.uid, {
    displayName: session.displayName,
    email: session.email,
  });

  store.import(normalized);
  await firebaseClient.writeWorkspace(normalized);
}

function createLocalStore() {
  const store = new WorkspaceStore(new BrowserWorkspaceStorage());
  store.load();
  return store;
}

function useSystem() {
  const [store, setStore] = useState(createLocalStore);
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

  const activateSession = async (next: FirebaseSession) => {
    setCloudReady(false);
    setCloudError("");

    const nextStore = buildUserStore(next);
    setStore(nextStore);
    setSession(next);

    try {
      await hydrateAuthenticatedStore(nextStore, next);
      setCloudReady(true);
    } catch (error) {
      setCloudError(
        error instanceof Error
          ? error.message
          : "No se pudo sincronizar con Firebase.",
      );
      throw error;
    }
  };

  useEffect(() => {
    let active = true;

    void firebaseClient
      .getSession()
      .then(async (saved) => {
        if (!active || !saved) return;
        await activateSession(saved);
      })
      .catch((error) => {
        if (!active) return;
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
  }, []);

  useEffect(() => {
    if (!session || !cloudReady || !store.ready) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      void firebaseClient.writeWorkspace(store.getSnapshot()).catch((error) => {
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
    const timer = setTimeout(
      () => setToast(null),
      toast.error ? 7000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, error = false) =>
    setToast({ message, error });

  const run = <T,>(action: () => T, message?: string): T | undefined => {
    try {
      const result = action();
      if (message) notify(message);
      return result;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudo completar la acción.",
        true,
      );
      return undefined;
    }
  };

  const signInWithGoogle = async () => {
    const next = await firebaseClient.signInWithGoogle();
    await activateSession(next);
    notify("NEXUS conectado con Google y Firebase.");
  };

  const signIn = async (email: string, password: string) => {
    const next = await firebaseClient.signIn(email, password);
    await activateSession(next);
    notify("NEXUS conectado a Firebase.");
  };

  const signUp = async (email: string, password: string) => {
    const next = await firebaseClient.signUp(email, password);
    await activateSession(next);
    notify("Cuenta creada y NEXUS sincronizado.");
  };

  const signOut = async () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    await firebaseClient.signOut();
    setSession(null);
    setCloudReady(false);
    setCloudError("");
    setStore(createLocalStore());
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
    cloudError,
    reduceMotion,
    projects: data.projects,
    inbox: data.inbox,
    activeFlow: data.activeFlow,
    session,
    authReady,
    cloudReady,
    signInWithGoogle,
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
