"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBJpy4DFBSaD4d4weknjHxfxwn_uMY5mS4",
  authDomain: "nexus-96795.firebaseapp.com",
  projectId: "nexus-96795",
  storageBucket: "nexus-96795.firebasestorage.app",
  messagingSenderId: "575269860819",
  appId: "1:575269860819:web:42d743b77bc3be5d3b6b26",
  measurementId: "G-M33SBNWPD2",
} as const;

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);

if (typeof window !== "undefined") {
  void setPersistence(firebaseAuth, browserLocalPersistence);
}

export const firestore = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      ignoreUndefinedProperties: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
})();

export const firebaseStorage = getStorage(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function observeFirebaseAuth(
  listener: (user: FirebaseUser | null) => void,
) {
  return onAuthStateChanged(firebaseAuth, listener);
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(firebaseAuth, googleProvider);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function signOutFirebase() {
  await firebaseSignOut(firebaseAuth);
}

export async function initFirebaseAnalytics() {
  if (typeof window === "undefined") return false;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return false;
  getAnalytics(firebaseApp);
  return true;
}

export type { FirebaseUser };
