import type { Workspace } from "@/domain/models";

const FIREBASE_SDK_VERSION = "12.19.0";

export const firebaseConfig = {
  apiKey: "AIzaSyBJpy4DFBSaD4d4weknjHxfxwn_uMY5mS4",
  authDomain: "nexus-96795.firebaseapp.com",
  projectId: "nexus-96795",
  storageBucket: "nexus-96795.firebasestorage.app",
  messagingSenderId: "575269860819",
  appId: "1:575269860819:web:42d743b77bc3be5d3b6b26",
  measurementId: "G-M33SBNWPD2",
} as const;

export interface FirebaseSession {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface CompatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface CompatGoogleProvider {
  setCustomParameters(parameters: Record<string, string>): void;
}

interface CompatAuthResult {
  user: CompatUser | null;
}

interface CompatAuth {
  currentUser: CompatUser | null;
  onAuthStateChanged(
    next: (user: CompatUser | null) => void,
    error?: (error: Error) => void,
  ): () => void;
  signInWithPopup(provider: CompatGoogleProvider): Promise<CompatAuthResult>;
  signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<CompatAuthResult>;
  createUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<CompatAuthResult>;
  signOut(): Promise<void>;
}

interface CompatDocumentSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface CompatDocumentReference {
  get(): Promise<CompatDocumentSnapshot>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<void>;
}

interface CompatCollectionReference {
  doc(id: string): CompatDocumentReference;
}

interface CompatFirestore {
  collection(name: string): CompatCollectionReference;
}

interface CompatStorageSnapshot {
  ref: CompatStorageReference;
}

interface CompatStorageReference {
  child(path: string): CompatStorageReference;
  put(
    file: File,
    metadata?: {
      contentType?: string;
      customMetadata?: Record<string, string>;
    },
  ): Promise<CompatStorageSnapshot>;
  getDownloadURL(): Promise<string>;
  delete(): Promise<void>;
}

interface CompatStorage {
  ref(): CompatStorageReference;
}

interface FirebaseCompatNamespace {
  apps: unknown[];
  initializeApp(config: typeof firebaseConfig): unknown;
  auth: (() => CompatAuth) & {
    GoogleAuthProvider: new () => CompatGoogleProvider;
  };
  firestore(): CompatFirestore;
  storage(): CompatStorage;
  analytics?: () => unknown;
}

declare global {
  interface Window {
    firebase?: FirebaseCompatNamespace;
  }
}

let sdkPromise: Promise<FirebaseCompatNamespace> | null = null;
const workspaceQueues = new Map<string, Promise<void>>();

function loadScript(product: string) {
  return new Promise<void>((resolve, reject) => {
    const id = "nexus-firebase-" + product;
    const existing = document.getElementById(id) as HTMLScriptElement | null;

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Firebase " + product + ".")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src =
      "https://www.gstatic.com/firebasejs/" +
      FIREBASE_SDK_VERSION +
      "/firebase-" +
      product +
      "-compat.js";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar Firebase " + product + ".")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function getFirebase() {
  if (typeof window === "undefined")
    throw new Error("Firebase solo está disponible en el navegador.");

  if (!sdkPromise) {
    sdkPromise = (async () => {
      await loadScript("app");
      await Promise.all([
        loadScript("auth"),
        loadScript("firestore"),
        loadScript("storage"),
      ]);

      const firebase = window.firebase;
      if (!firebase) throw new Error("Firebase no pudo inicializarse.");

      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

      void loadScript("analytics")
        .then(() => {
          try {
            firebase.analytics?.();
          } catch {
            // Analytics may be unavailable in privacy-restricted browsers.
          }
        })
        .catch(() => undefined);

      return firebase;
    })();
  }

  return sdkPromise;
}

function sessionFromUser(user: CompatUser | null): FirebaseSession | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

function friendlyFirebaseError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "No se pudo completar la operación con Firebase.";

  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  const known: Record<string, string> = {
    "auth/operation-not-allowed":
      "Activa este método de acceso en Firebase Authentication.",
    "auth/popup-blocked":
      "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para NEXUS.",
    "auth/popup-closed-by-user":
      "Se cerró la ventana de Google antes de terminar el acceso.",
    "auth/unauthorized-domain":
      "Este dominio todavía no está autorizado en Firebase Authentication.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-disabled": "Esta cuenta está deshabilitada.",
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "El correo no es válido.",
  };

  return new Error(known[code] ?? raw);
}

async function requireSession() {
  const firebase = await getFirebase();
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Inicia sesión para sincronizar NEXUS.");
  return sessionFromUser(user)!;
}

function userDocument(firebase: FirebaseCompatNamespace, uid: string) {
  return firebase.firestore().collection("users").doc(uid);
}

async function writeWorkspaceNow(workspace: Workspace) {
  const firebase = await getFirebase();
  const session = await requireSession();
  const plain = JSON.parse(JSON.stringify(workspace)) as Workspace;

  await userDocument(firebase, session.uid).set(
    {
      workspace: plain,
      schemaVersion: workspace.schemaVersion,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export const firebaseClient = {
  config: firebaseConfig,

  async getSession(): Promise<FirebaseSession | null> {
    const firebase = await getFirebase();
    const auth = firebase.auth();

    if (auth.currentUser) return sessionFromUser(auth.currentUser);

    return new Promise<FirebaseSession | null>((resolve, reject) => {
      let unsubscribe: () => void = () => undefined;
      unsubscribe = auth.onAuthStateChanged(
        (user) => {
          unsubscribe();
          resolve(sessionFromUser(user));
        },
        (error) => {
          unsubscribe();
          reject(friendlyFirebaseError(error));
        },
      );
    });
  },

  async signInWithGoogle() {
    try {
      const firebase = await getFirebase();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await firebase.auth().signInWithPopup(provider);
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Google no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async signIn(email: string, password: string) {
    try {
      const firebase = await getFirebase();
      const result = await firebase
        .auth()
        .signInWithEmailAndPassword(email.trim(), password);
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Firebase no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async signUp(email: string, password: string) {
    try {
      const firebase = await getFirebase();
      const result = await firebase
        .auth()
        .createUserWithEmailAndPassword(email.trim(), password);
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Firebase no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async signOut() {
    const firebase = await getFirebase();
    await firebase.auth().signOut();
  },

  async readWorkspace(): Promise<Workspace | null> {
    const firebase = await getFirebase();
    const session = await requireSession();
    const snapshot = await userDocument(firebase, session.uid).get();

    if (!snapshot.exists) return null;

    const value = snapshot.data()?.workspace;
    if (!value) return null;

    if (typeof value === "string") {
      return JSON.parse(value) as Workspace;
    }

    return value as Workspace;
  },

  async writeWorkspace(workspace: Workspace) {
    const session = await requireSession();
    const previous = workspaceQueues.get(session.uid) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => writeWorkspaceNow(workspace));

    workspaceQueues.set(session.uid, next);

    try {
      await next;
    } finally {
      if (workspaceQueues.get(session.uid) === next)
        workspaceQueues.delete(session.uid);
    }
  },

  async uploadFile(file: File) {
    const firebase = await getFirebase();
    const session = await requireSession();

    if (file.size > 25 * 1024 * 1024)
      throw new Error("El archivo supera el límite de 25 MB.");

    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "archivo";
    const path =
      "users/" +
      session.uid +
      "/attachments/" +
      crypto.randomUUID() +
      "/" +
      safeName;

    const ref = firebase.storage().ref().child(path);
    await ref.put(file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: { ownerId: session.uid },
    });

    return { path };
  },

  async getDownloadUrl(path: string) {
    const firebase = await getFirebase();
    const session = await requireSession();

    if (!path.startsWith("users/" + session.uid + "/attachments/"))
      throw new Error("Ruta de archivo no autorizada.");

    return firebase.storage().ref().child(path).getDownloadURL();
  },

  async deleteFile(path: string) {
    const firebase = await getFirebase();
    const session = await requireSession();

    if (!path.startsWith("users/" + session.uid + "/attachments/"))
      throw new Error("Ruta de archivo no autorizada.");

    await firebase.storage().ref().child(path).delete();
  },
};
