"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  executeMutation,
  executeQuery,
  getDataConnect,
  mutationRef,
  queryRef,
  type DataConnect,
} from "firebase/data-connect";
import { firebaseConfig, type FirebaseSession } from "@/lib/firebase";

const connectorConfig = {
  connector: "nexus",
  service: "nexus-core",
  location: "us-east4",
} as const;

let dataConnect: DataConnect | null = null;

function getSqlConnect() {
  if (typeof window === "undefined")
    throw new Error("SQL Connect solo está disponible en el navegador.");

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // Initializing modular Auth causes Data Connect to attach the persisted
  // Firebase identity for this app. The existing compat login uses the same
  // project/API key and browser persistence.
  getAuth(app);

  if (!dataConnect) dataConnect = getDataConnect(app, connectorConfig);
  return dataConnect;
}

export interface SqlWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  kind: string;
  currency: string;
  timezone: string;
  role: string;
  status: string;
}

export async function getCurrentSqlUser() {
  const dc = getSqlConnect();
  const result = await executeQuery(queryRef(dc, "GetCurrentUser"));
  return result.data as {
    appUser?: {
      uid: string;
      email: string;
      displayName?: string | null;
      photoUrl?: string | null;
      timezone: string;
    } | null;
  };
}

export async function getMySqlWorkspaces(): Promise<SqlWorkspaceSummary[]> {
  const dc = getSqlConnect();
  const result = await executeQuery(queryRef(dc, "GetMyWorkspaces"));
  const data = result.data as {
    appUser?: {
      memberships?: Array<{
        role: string;
        status: string;
        workspace: Omit<SqlWorkspaceSummary, "role" | "status">;
      }>;
    } | null;
  };

  return (data.appUser?.memberships ?? []).map((membership) => ({
    ...membership.workspace,
    role: membership.role,
    status: membership.status,
  }));
}

export async function bootstrapPersonalSqlWorkspace(args: {
  session: FirebaseSession;
  timezone: string;
  preferences: unknown;
}) {
  const dc = getSqlConnect();
  const existing = await getMySqlWorkspaces();
  const personal = existing.find(
    (membership) =>
      membership.kind === "personal" && membership.status === "active",
  );
  if (personal) return { created: false, workspace: personal };

  const slug =
    "personal-" +
    args.session.uid
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

  await executeMutation(
    mutationRef(dc, "BootstrapPersonalWorkspace", {
      email: args.session.email,
      displayName: args.session.displayName,
      photoUrl: args.session.photoURL,
      locale: "es-NI",
      timezone: args.timezone,
      preferences: args.preferences,
      workspaceName: "Personal",
      workspaceSlug: slug,
      legacyId: "personal:" + args.session.uid,
    }),
  );

  const after = await getMySqlWorkspaces();
  const workspace = after.find(
    (membership) =>
      membership.kind === "personal" && membership.status === "active",
  );
  if (!workspace)
    throw new Error("PostgreSQL no devolvió el workspace recién creado.");

  return { created: true, workspace };
}

export async function getSqlWorkspaceCore(args: {
  workspaceId: string;
  from: Date;
  to: Date;
}) {
  const dc = getSqlConnect();
  const result = await executeQuery(
    queryRef(dc, "GetWorkspaceCore", {
      workspaceId: args.workspaceId,
      from: args.from.toISOString(),
      to: args.to.toISOString(),
    }),
  );
  return result.data;
}

export const sqlConnectClient = {
  connectorConfig,
  getCurrentUser: getCurrentSqlUser,
  getMyWorkspaces: getMySqlWorkspaces,
  bootstrapPersonalWorkspace: bootstrapPersonalSqlWorkspace,
  getWorkspaceCore: getSqlWorkspaceCore,
};
