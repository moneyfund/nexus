import type { Workspace } from "@/domain/models";

const config = {
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
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

const SESSION_KEY = "nexus-firebase-session";
const authUrl = (action: string) =>
  `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${config.apiKey}`;

async function parseError(response: Response) {
  try {
    const data = await response.json();
    const code = data?.error?.message ?? "FIREBASE_ERROR";
    const messages: Record<string, string> = {
      EMAIL_EXISTS: "Ese correo ya tiene una cuenta.",
      INVALID_LOGIN_CREDENTIALS: "Correo o contraseña incorrectos.",
      INVALID_PASSWORD: "Correo o contraseña incorrectos.",
      EMAIL_NOT_FOUND: "Correo o contraseña incorrectos.",
      WEAK_PASSWORD: "La contraseña debe tener al menos 6 caracteres.",
      INVALID_EMAIL: "El correo no es válido.",
      USER_DISABLED: "Esta cuenta está deshabilitada.",
      OPERATION_NOT_ALLOWED:
        "Activa Email/Password en Firebase Authentication para continuar.",
    };
    return new Error(messages[code] ?? code.replaceAll("_", " ").toLowerCase());
  } catch {
    return new Error("No se pudo completar la operación con Firebase.");
  }
}

function saveSession(session: FirebaseSession | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function exchangePassword(
  action: "signUp" | "signInWithPassword",
  email: string,
  password: string,
): Promise<FirebaseSession> {
  const response = await fetch(authUrl(action), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw await parseError(response);
  const data = await response.json();
  const session: FirebaseSession = {
    uid: data.localId,
    email: data.email ?? email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn ?? 3600) * 1000 - 60_000,
  };
  saveSession(session);
  return session;
}

async function refresh(session: FirebaseSession) {
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
    },
  );
  if (!response.ok) {
    saveSession(null);
    return null;
  }
  const data = await response.json();
  const next: FirebaseSession = {
    uid: data.user_id,
    email: session.email,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 - 60_000,
  };
  saveSession(next);
  return next;
}

async function currentSession(): Promise<FirebaseSession | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as FirebaseSession;
    if (!session.uid || !session.refreshToken) throw new Error();
    return session.expiresAt > Date.now() ? session : await refresh(session);
  } catch {
    saveSession(null);
    return null;
  }
}

async function authorizedSession() {
  const session = await currentSession();
  if (!session) throw new Error("Inicia sesión para sincronizar NEXUS.");
  return session;
}

const firestoreDocument = (uid: string) =>
  `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

export const firebaseClient = {
  config,
  getSession: currentSession,

  signUp(email: string, password: string) {
    return exchangePassword("signUp", email.trim(), password);
  },

  signIn(email: string, password: string) {
    return exchangePassword("signInWithPassword", email.trim(), password);
  },

  signOut() {
    saveSession(null);
  },

  async readWorkspace(): Promise<Workspace | null> {
    const session = await authorizedSession();
    const response = await fetch(firestoreDocument(session.uid), {
      headers: { Authorization: `Bearer ${session.idToken}` },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    const payload = data?.fields?.workspace?.stringValue;
    return payload ? (JSON.parse(payload) as Workspace) : null;
  },

  async writeWorkspace(workspace: Workspace) {
    const session = await authorizedSession();
    const response = await fetch(firestoreDocument(session.uid), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          workspace: { stringValue: JSON.stringify(workspace) },
          updatedAt: { integerValue: String(Date.now()) },
          schemaVersion: { integerValue: String(workspace.schemaVersion) },
        },
      }),
    });
    if (!response.ok) throw await parseError(response);
  },

  async uploadFile(file: File) {
    const session = await authorizedSession();
    const path = `users/${session.uid}/attachments/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const response = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.idToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      },
    );
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return {
      path: data.name as string,
      downloadToken: (data.downloadTokens as string | undefined)?.split(",")[0],
    };
  },

  getDownloadUrl(path: string, token?: string) {
    const base = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodeURIComponent(path)}?alt=media`;
    return token ? `${base}&token=${encodeURIComponent(token)}` : base;
  },

  async deleteFile(path: string) {
    const session = await authorizedSession();
    const response = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.idToken}` },
      },
    );
    if (!response.ok && response.status !== 404) throw await parseError(response);
  },
};
