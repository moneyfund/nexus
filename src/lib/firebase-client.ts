"use client";

import type { Attachment, Workspace } from "@/domain/models";
import { entity } from "@/domain/seed";
import type { StorageProvider } from "@/services/providers";

const FIREBASE_SDK_VERSION = "12.19.0";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBJpy4DFBSaD4d4weknjHxfxwn_uMY5mS4",
  authDomain: "nexus-96795.firebaseapp.com",
  projectId: "nexus-96795",
  storageBucket: "nexus-96795.firebasestorage.app",
  messagingSenderId: "575269860819",
  appId: "1:575269860819:web:42d743b77bc3be5d3b6b26",
  measurementId: "G-M33SBNWPD2",
} as const;

export interface FirebaseUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

type Unsubscribe = () => void;

interface CompatAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface CompatGoogleProvider {
  setCustomParameters(parameters: Record<string, string>): void;
}

interface CompatUserCredential {
  user: CompatAuthUser | null;
}

interface CompatAuth {
  currentUser: CompatAuthUser | null;
  onAuthStateChanged(
    next: (user: CompatAuthUser | null) => void,
    error?: (error: Error) => void,
  ): Unsubscribe;
  signInWithPopup(provider: CompatGoogleProvider): Promise<CompatUserCredential>;
  signOut(): Promise<void>;
}

interface CompatDocumentSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface CompatDocumentReference {
  get(): Promise<CompatDocumentSnapshot>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
}

interface CompatCollectionReference {
  doc(id: string): CompatDocumentReference;
}

interface CompatFirestore {
  collection(name: string): CompatCollectionReference;
}

interface CompatStorageSnapshot {
  ref: {
    getDownloadURL(): Promise<string>;
  };
}

interface CompatStorageReference {
  child(path: string): CompatStorageReference;
  put(
    file: File,
    metadata?: { contentType?: string; customMetadata?: Record<string, string> },
  ): Promise<CompatStorageSnapshot>;
  getDownloadURL(): Promise<string>;
  delete(): Promise<void>;
}

interface CompatStorage {
  ref(): CompatStorageReference;
}

interface FirebaseCompatNamespace {
  apps: unknown[];
  initializeApp(config: typeof FIREBASE_CONFIG): unknown;
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
const cloudWriteQueues = new Map<string, Promise<void>>();

function loadScript(product: string) {
  return new Promise<void>((resolve, reject) => {
    const id = `nexus-firebase-${product}`;
    const loaded = document.getElementById(id) as HTMLScriptElement | null;
    if (loaded?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (loaded) {
      loaded.addEventListener("load", () => resolve(), { once: true });
      loaded.addEventListener(
        "error",
        () => reject(new Error(`No se pudo cargar Firebase ${product}.`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-${product}-compat.js`;
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
      () => reject(new Error(`No se pudo cargar Firebase ${product}.`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export async function getFirebase() {
  if (typeof window === "undefined")
    throw new Error("Firebase solo está disponible en el navegador.");
  if (!sdkPromise) {
    sdkPromise = (async () => {
      await loadScript("app");
      await Promise.all([
        loadScript("auth"),
        loadScript("firestore"),
        loadScript("storage"),
        loadScript("analytics"),
      ]);
      const firebase = window.firebase;
      if (!firebase) throw new Error("Firebase no pudo inicializarse.");
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      try {
        firebase.analytics?.();
      } catch {
        // Analytics can be unavailable in privacy-restricted browsers.
      }
      return firebase;
    })();
  }
  return sdkPromise;
}

function profile(user: CompatAuthUser | null): FirebaseUserProfile | null {
  return user
    ? {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      }
    : null;
}

export async function observeFirebaseAuth(
  listener: (user: FirebaseUserProfile | null) => void,
  onError?: (message: string) => void,
) {
  const firebase = await getFirebase();
  return firebase.auth().onAuthStateChanged(
    (user) => listener(profile(user)),
    (error) => onError?.(error.message),
  );
}

export async function signInWithGoogle() {
  const firebase = await getFirebase();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await firebase.auth().signInWithPopup(provider);
  const user = profile(result.user);
  if (!user) throw new Error("Google no devolvió una sesión válida.");
  return user;
}

export async function signOutFirebase() {
  const firebase = await getFirebase();
  await firebase.auth().signOut();
}

function cloudDocument(firebase: FirebaseCompatNamespace, userId: string) {
  return firebase
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("workspace")
    .doc("current");
}

export async function loadWorkspaceFromCloud(
  userId: string,
): Promise<Workspace | null> {
  const firebase = await getFirebase();
  const snapshot = await cloudDocument(firebase, userId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  return (data?.workspace as Workspace | undefined) ?? null;
}

async function saveWorkspaceToCloud(userId: string, workspace: Workspace) {
  const firebase = await getFirebase();
  const plain = JSON.parse(JSON.stringify(workspace)) as Workspace;
  await cloudDocument(firebase, userId).set(
    {
      schemaVersion: workspace.schemaVersion,
      updatedAt: Date.now(),
      workspace: plain,
    },
    { merge: false },
  );
}

export function queueWorkspaceCloudSave(
  userId: string,
  workspace: Workspace,
): Promise<void> {
  const previous = cloudWriteQueues.get(userId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => saveWorkspaceToCloud(userId, workspace));
  cloudWriteQueues.set(userId, next);
  return next.finally(() => {
    if (cloudWriteQueues.get(userId) === next) cloudWriteQueues.delete(userId);
  });
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "archivo";
}

export class FirebaseFileStorageService implements StorageProvider {
  async upload(userId: string, file: File): Promise<Attachment> {
    const firebase = await getFirebase();
    const id = crypto.randomUUID();
    const path = `users/${userId}/attachments/${id}/${safeFileName(file.name)}`;
    const ref = firebase.storage().ref().child(path);
    await ref.put(file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: { ownerId: userId },
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
      attachment.userId !== userId ||
      attachment.provider !== "firebase" ||
      !attachment.externalId
    )
      return null;
    const firebase = await getFirebase();
    return firebase.storage().ref().child(attachment.externalId).getDownloadURL();
  }

  async remove(userId: string, id: string) {
    if (!id.startsWith(`users/${userId}/attachments/`))
      throw new Error("Ruta de archivo no autorizada.");
    const firebase = await getFirebase();
    await firebase.storage().ref().child(id).delete();
  }
}
