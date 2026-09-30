import type { CalendarEvent } from "@/domain/models";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

const STORAGE_KEY = "nexus-google-workspace-v2";
const LEGACY_SESSION_KEY = "nexus-google-workspace-v1";

export interface GoogleWorkspaceGrant {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
  connectedAt?: number;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
}

export interface GoogleDriveContent {
  readable: boolean;
  text: string;
  format: string;
  truncated: boolean;
  reason?: string;
}

interface GoogleCalendarWireEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

function localStorageSafe() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function sessionStorageSafe() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function validGrant(value: unknown): value is GoogleWorkspaceGrant {
  if (!value || typeof value !== "object") return false;
  const grant = value as GoogleWorkspaceGrant;
  return (
    typeof grant.accessToken === "string" &&
    !!grant.accessToken &&
    Number.isFinite(grant.expiresAt) &&
    Array.isArray(grant.scopes)
  );
}

export function readGoogleWorkspaceGrant(): GoogleWorkspaceGrant | null {
  const local = localStorageSafe();
  const session = sessionStorageSafe();

  try {
    const raw = local?.getItem(STORAGE_KEY) ?? session?.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!validGrant(parsed) || parsed.expiresAt <= Date.now() + 30_000) {
      local?.removeItem(STORAGE_KEY);
      session?.removeItem(LEGACY_SESSION_KEY);
      return null;
    }

    // Migrate older session-only grants into browser-local persistence.
    if (!local?.getItem(STORAGE_KEY)) {
      local?.setItem(STORAGE_KEY, JSON.stringify(parsed));
      session?.removeItem(LEGACY_SESSION_KEY);
    }
    return parsed;
  } catch {
    local?.removeItem(STORAGE_KEY);
    session?.removeItem(LEGACY_SESSION_KEY);
    return null;
  }
}

export function saveGoogleWorkspaceGrant(grant: GoogleWorkspaceGrant) {
  const normalized = {
    ...grant,
    connectedAt: grant.connectedAt ?? Date.now(),
  };
  const serialized = JSON.stringify(normalized);
  const local = localStorageSafe();
  const session = sessionStorageSafe();

  try {
    local?.setItem(STORAGE_KEY, serialized);
    session?.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Some privacy modes disable localStorage. Keep the grant session-only.
    session?.setItem(LEGACY_SESSION_KEY, serialized);
  }
}

export function clearGoogleWorkspaceGrant() {
  try {
    localStorageSafe()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browser storage restrictions while disconnecting.
  }
  try {
    sessionStorageSafe()?.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Ignore browser storage restrictions while disconnecting.
  }
}

async function googleError(response: Response) {
  let detail = "";
  try {
    const body = (await response.clone().json()) as {
      error?: { message?: string };
    };
    detail = body.error?.message ?? "";
  } catch {
    detail = await response.text().catch(() => "");
  }
  return (
    detail ||
    "Google Workspace rechazó la operación (" + response.status + ")."
  );
}

async function googleFetch<T>(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    clearGoogleWorkspaceGrant();
    throw new Error(
      "La autorización de Google caducó. Vuelve a conectar Google Workspace.",
    );
  }

  if (!response.ok) throw new Error(await googleError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function googleTextFetch(token: string, url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "text/plain,text/csv,application/json,*/*",
    },
  });

  if (response.status === 401) {
    clearGoogleWorkspaceGrant();
    throw new Error(
      "La autorización de Google caducó. Vuelve a conectar Google Workspace.",
    );
  }

  if (!response.ok) throw new Error(await googleError(response));
  return response.text();
}

function googleDate(value?: { dateTime?: string; date?: string }) {
  if (value?.dateTime) return value.dateTime;
  if (value?.date) return value.date + "T00:00:00.000Z";
  return new Date().toISOString();
}

function toCalendarEvent(
  item: GoogleCalendarWireEvent,
  userId: string,
): CalendarEvent {
  const now = Date.now();
  return {
    id: "google-calendar-" + item.id,
    userId,
    createdAt: now,
    updatedAt: now,
    source: "user",
    title: item.summary?.trim() || "Evento de Google Calendar",
    start: googleDate(item.start),
    end: googleDate(item.end),
    category: "meeting",
    description: item.description,
    providerId: item.id,
    metadata: {
      provider: "google",
      googleLink: item.htmlLink ?? "",
    },
  };
}

function calendarPayload(event: CalendarEvent) {
  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    extendedProperties: {
      private: {
        nexusId: event.id,
        nexusProjectId: event.projectId ?? "",
      },
    },
  };
}

function readableDriveStrategy(file: GoogleDriveFile) {
  if (file.mimeType === "application/vnd.google-apps.document")
    return { mode: "export" as const, mimeType: "text/plain", format: "Google Docs" };
  if (file.mimeType === "application/vnd.google-apps.spreadsheet")
    return { mode: "export" as const, mimeType: "text/csv", format: "Google Sheets" };
  if (file.mimeType === "application/vnd.google-apps.presentation")
    return { mode: "export" as const, mimeType: "text/plain", format: "Google Slides" };

  const directText =
    file.mimeType.startsWith("text/") ||
    [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/x-javascript",
      "application/sql",
    ].includes(file.mimeType);

  if (directText)
    return { mode: "media" as const, mimeType: file.mimeType, format: file.mimeType };

  return null;
}

export const googleWorkspaceClient = {
  async listCalendarEvents(
    token: string,
    userId: string,
    from: string,
    to: string,
  ) {
    const params = new URLSearchParams({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });
    const body = await googleFetch<{ items?: GoogleCalendarWireEvent[] }>(
      token,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
        params.toString(),
    );
    return (body.items ?? [])
      .filter((item) => item.status !== "cancelled")
      .map((item) => toCalendarEvent(item, userId));
  },

  async createCalendarEvent(token: string, event: CalendarEvent) {
    const created = await googleFetch<GoogleCalendarWireEvent>(
      token,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        body: JSON.stringify(calendarPayload(event)),
      },
    );
    return {
      ...event,
      providerId: created.id,
      metadata: {
        ...event.metadata,
        provider: "google",
        googleLink: created.htmlLink ?? "",
      },
    };
  },

  async updateCalendarEvent(token: string, event: CalendarEvent) {
    if (!event.providerId) return this.createCalendarEvent(token, event);
    const updated = await googleFetch<GoogleCalendarWireEvent>(
      token,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
        encodeURIComponent(event.providerId),
      {
        method: "PATCH",
        body: JSON.stringify(calendarPayload(event)),
      },
    );
    return {
      ...event,
      providerId: updated.id,
      metadata: {
        ...event.metadata,
        provider: "google",
        googleLink: updated.htmlLink ?? "",
      },
    };
  },

  async deleteCalendarEvent(token: string, providerId: string) {
    await googleFetch<void>(
      token,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
        encodeURIComponent(providerId),
      { method: "DELETE" },
    );
  },

  async listDriveFiles(token: string, query = "") {
    const safeQuery = query.trim().replace(/'/g, "\\'");
    const q = [
      "trashed = false",
      safeQuery ? "name contains '" + safeQuery + "'" : "",
    ]
      .filter(Boolean)
      .join(" and ");
    const params = new URLSearchParams({
      q,
      pageSize: "50",
      orderBy: "modifiedTime desc",
      spaces: "drive",
      fields:
        "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)",
    });
    const body = await googleFetch<{ files?: GoogleDriveFile[] }>(
      token,
      "https://www.googleapis.com/drive/v3/files?" + params.toString(),
    );
    return body.files ?? [];
  },

  async readDriveFile(
    token: string,
    file: GoogleDriveFile,
    maxChars = 50_000,
  ): Promise<GoogleDriveContent> {
    const strategy = readableDriveStrategy(file);
    if (!strategy) {
      return {
        readable: false,
        text: "",
        format: file.mimeType,
        truncated: false,
        reason:
          file.mimeType === "application/pdf"
            ? "El PDF queda enlazado; la extracción de texto PDF todavía no está habilitada."
            : "Este formato queda enlazado, pero Google Drive no ofrece texto directo para indexarlo.",
      };
    }

    const base =
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id);
    const url =
      strategy.mode === "export"
        ? base +
          "/export?" +
          new URLSearchParams({ mimeType: strategy.mimeType }).toString()
        : base + "?alt=media";

    const raw = await googleTextFetch(token, url);
    const normalized = raw.replace(/\u0000/g, "").trim();
    const truncated = normalized.length > maxChars;
    return {
      readable: true,
      text: truncated ? normalized.slice(0, maxChars) : normalized,
      format: strategy.format,
      truncated,
      reason: normalized
        ? undefined
        : "El archivo no devolvió contenido de texto.",
    };
  },
};
