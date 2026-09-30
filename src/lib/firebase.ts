import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import type { Workspace } from "@/domain/models";

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

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const workspaceQueues = new Map<string, Promise<void>>();

function sessionFromUser(user: User | null): FirebaseSession | null {
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

async function requireUser() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para sincronizar NEXUS.");
  return user;
}

function workspaceDocument(uid: string) {
  return doc(firestore, "users", uid);
}

async function writeWorkspaceNow(workspace: Workspace) {
  const user = await requireUser();
  const plain = JSON.parse(JSON.stringify(workspace)) as Workspace;

  await setDoc(
    workspaceDocument(user.uid),
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
    await auth.authStateReady();
    if (auth.currentUser) return sessionFromUser(auth.currentUser);

    return new Promise<FirebaseSession | null>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Google no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async connectGoogleWorkspace() {
    try {
      const user = await requireUser();
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/calendar.events");
      provider.addScope("https://www.googleapis.com/auth/drive.readonly");
      provider.setCustomParameters({
        prompt: "consent",
        include_granted_scopes: "true",
      });

      const result = await reauthenticateWithPopup(user, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (!accessToken)
        throw new Error("Google no devolvió un token para Workspace.");

      return {
        accessToken,
        connectedAt: Date.now(),
        expiresAt: Date.now() + 50 * 60 * 1000,
        scopes: [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      };
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async getIdToken() {
    const user = await requireUser();
    return user.getIdToken();
  },

  async signIn(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Firebase no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async signUp(email: string, password: string) {
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const session = sessionFromUser(result.user);
      if (!session) throw new Error("Firebase no devolvió una sesión válida.");
      return session;
    } catch (error) {
      throw friendlyFirebaseError(error);
    }
  },

  async signOut() {
    await firebaseSignOut(auth);
  },

  async readWorkspace(): Promise<Workspace | null> {
    const user = await requireUser();
    const snapshot = await getDoc(workspaceDocument(user.uid));
    if (!snapshot.exists()) return null;

    const value = snapshot.data()?.workspace;
    if (!value) return null;
    if (typeof value === "string") return JSON.parse(value) as Workspace;
    return value as Workspace;
  },

  async writeWorkspace(workspace: Workspace) {
    const user = await requireUser();
    const previous = workspaceQueues.get(user.uid) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => writeWorkspaceNow(workspace));

    workspaceQueues.set(user.uid, next);

    try {
      await next;
    } finally {
      if (workspaceQueues.get(user.uid) === next)
        workspaceQueues.delete(user.uid);
    }
  },

  async uploadFile(file: File) {
    const user = await requireUser();

    if (file.size > 25 * 1024 * 1024)
      throw new Error("El archivo supera el límite de 25 MB.");

    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "archivo";
    const path =
      "users/" +
      user.uid +
      "/attachments/" +
      crypto.randomUUID() +
      "/" +
      safeName;

    await uploadBytes(ref(storage, path), file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: { ownerId: user.uid },
    });

    return { path };
  },

  async getDownloadUrl(path: string) {
    const user = await requireUser();

    if (!path.startsWith("users/" + user.uid + "/attachments/"))
      throw new Error("Ruta de archivo no autorizada.");

    return getDownloadURL(ref(storage, path));
  },

  async deleteFile(path: string) {
    const user = await requireUser();

    if (!path.startsWith("users/" + user.uid + "/attachments/"))
      throw new Error("Ruta de archivo no autorizada.");

    await deleteObject(ref(storage, path));
  },
};
