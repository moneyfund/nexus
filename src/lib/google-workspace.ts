import type { CalendarEvent } from "@/domain/models";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

const SESSION_KEY = "nexus-google-workspace-v1";

export interface GoogleWorkspaceGrant {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
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

interface GoogleCalendarWireEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

function browserStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function readGoogleWorkspaceGrant(): GoogleWorkspaceGrant | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleWorkspaceGrant;
    if (
      !parsed.accessToken ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() + 30_000
    ) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGoogleWorkspaceGrant(grant: GoogleWorkspaceGrant) {
  browserStorage()?.setItem(SESSION_KEY, JSON.stringify(grant));
}

export function clearGoogleWorkspaceGrant() {
  browserStorage()?.removeItem(SESSION_KEY);
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

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      detail = body.error?.message ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(
      detail ||
        "Google Workspace rechazó la operación (" + response.status + ").",
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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
};
