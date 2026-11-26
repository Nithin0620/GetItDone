import { ensureIndexes, getDb } from "@/lib/mongodb";
import type { Task } from "@/lib/types";
import { randomUUID, randomBytes } from "node:crypto";
import { shiftDate, uid } from "@/lib/utils";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface CalendarIntegration {
  userId: string;
  provider: "google";
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  scope: string;
  calendarId: string;
  syncToken: string | null;
  channelId: string | null;
  channelResourceId: string | null;
  channelToken: string | null;
  channelExpiration: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  status: "active" | "error";
  lastError: string | null;
}

export interface SyncResult {
  connected: boolean;
  pulled: number;
  pushed: number;
  conflicts: number;
  syncToken: string | null;
}

interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

interface GoogleEventList {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface GoogleChannel {
  resourceId?: string;
  expiration?: string | number;
}

export function publicUrl() {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function oauthConfig() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return {
    clientId,
    clientSecret,
    redirectUri: `${publicUrl()}/api/calendar/callback`,
    scope: "https://www.googleapis.com/auth/calendar.events",
  };
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

function normalizeIntegration(doc: Record<string, unknown>): CalendarIntegration {
  return {
    userId: asString(doc.userId),
    provider: "google",
    accessToken: asString(doc.accessToken),
    refreshToken: asString(doc.refreshToken),
    tokenExpiresAt: asString(doc.tokenExpiresAt),
    scope: asString(doc.scope),
    calendarId: asString(doc.calendarId, "primary"),
    syncToken: typeof doc.syncToken === "string" ? doc.syncToken : null,
    channelId: typeof doc.channelId === "string" ? doc.channelId : null,
    channelResourceId: typeof doc.channelResourceId === "string" ? doc.channelResourceId : null,
    channelToken: typeof doc.channelToken === "string" ? doc.channelToken : null,
    channelExpiration: doc.channelExpiration ? asString(doc.channelExpiration) : null,
    connectedAt: asString(doc.connectedAt),
    lastSyncedAt: doc.lastSyncedAt ? asString(doc.lastSyncedAt) : null,
    status: doc.status === "error" ? "error" : "active",
    lastError: typeof doc.lastError === "string" ? doc.lastError : null,
  };
}

export async function isCalendarAutosyncEnabled(userId: string): Promise<boolean> {
  const db = await getDb();
  await ensureIndexes(db);
  const user = await db.collection("users").findOne({ userId });
  const settings = user?.settings as { calendarSyncEnabled?: boolean } | undefined;
  return Boolean(settings?.calendarSyncEnabled);
}

export async function getIntegration(userId: string): Promise<CalendarIntegration | null> {
  const db = await getDb();
  await ensureIndexes(db);
  const doc = await db.collection("calendar_integrations").findOne({ userId });
  return doc ? normalizeIntegration(doc as Record<string, unknown>) : null;
}

export async function upsertIntegration(
  userId: string,
  patch: Partial<CalendarIntegration>,
): Promise<CalendarIntegration> {
  const db = await getDb();
  await ensureIndexes(db);
  const now = new Date();
  await db.collection("calendar_integrations").updateOne(
    { userId },
    { $set: { ...patch, updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
    { upsert: true },
  );
  const doc = await db.collection("calendar_integrations").findOne({ userId });
  return normalizeIntegration(doc as Record<string, unknown>);
}

async function googleFetch<T = unknown>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Google Calendar ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function ensureAccessToken(
  userId: string,
  integration: CalendarIntegration,
): Promise<string> {
  if (Date.parse(integration.tokenExpiresAt) > Date.now() + 60_000) return integration.accessToken;

  const config = oauthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: integration.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    await upsertIntegration(userId, { status: "error", lastError: "Token refresh failed" });
    throw new Error("Google Calendar token refresh failed");
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await upsertIntegration(userId, { accessToken: data.access_token, tokenExpiresAt, status: "active", lastError: null });
  return data.access_token;
}

function eventDate(event: GoogleEvent): string | undefined {
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) return new Date(event.start.dateTime).toISOString();
  return undefined;
}

function eventBody(task: Task) {
  const due = task.dueDate as string;
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(due);
  const start = allDay ? { date: due } : { dateTime: new Date(due).toISOString() };
  const end = allDay
    ? { date: shiftDate(due, 1) }
    : { dateTime: new Date(Date.parse(due) + 30 * 60_000).toISOString() };
  return {
    summary: task.title,
    description: task.description || "",
    start,
    end,
    extendedProperties: { private: { getitdoneTaskId: task.id } },
  };
}

async function applyRemoteEvent(
  userId: string,
  event: GoogleEvent,
): Promise<"added" | "updated" | "conflict" | "archived"> {
  const db = await getDb();
  const marker = event.extendedProperties?.private?.getitdoneTaskId as string | undefined;
  const existing = marker
    ? await db.collection("tasks").findOne({ userId, id: marker })
    : await db.collection("tasks").findOne({ userId, calendarEventId: event.id });

  if (event.status === "cancelled") {
    if (existing) {
      await db.collection("tasks").updateOne(
        { userId, id: existing.id },
        { $set: { archived: true, calendarSyncState: "synced", updatedAt: new Date().toISOString() } },
      );
      return "archived";
    }
    return "conflict";
  }

  const dueDate = eventDate(event);
  const remote = {
    title: String(event.summary ?? "Untitled event"),
    description: String(event.description ?? ""),
    dueDate,
    calendarEventId: String(event.id),
    calendarSyncState: "synced" as const,
    calendarUpdatedAt: String(event.updated ?? new Date().toISOString()),
    calendarSyncError: undefined,
    updatedAt: new Date().toISOString(),
  };

  if (!existing) {
    const now = new Date().toISOString();
    await db.collection("tasks").insertOne({
      id: uid("task"),
      workspaceId: null,
      status: "todo",
      priority: "medium",
      tags: [],
      checklist: [],
      recurrence: "none",
      links: [],
      comments: [],
      archived: false,
      myDay: false,
      order: Date.now(),
      createdAt: now,
      ...remote,
    });
    return "added";
  }

  if (existing.calendarSyncState === "local") {
    await db.collection("tasks").updateOne(
      { userId, id: existing.id },
      { $set: { calendarSyncState: "conflict", calendarSyncError: "Local and Google changes overlap" } },
    );
    return "conflict";
  }

  await db.collection("tasks").updateOne({ userId, id: existing.id }, { $set: remote });
  return "updated";
}

export async function pullRemoteChanges(
  userId: string,
  integration: CalendarIntegration,
  accessToken: string,
): Promise<{ pulled: number; conflicts: number; syncToken: string | null }> {
  const db = await getDb();
  let pageToken: string | undefined;
  let syncToken = integration.syncToken;
  let pulled = 0;
  let conflicts = 0;

  do {
    const params = new URLSearchParams({ maxResults: "2500" });
    if (integration.syncToken) {
      params.set("syncToken", integration.syncToken);
    } else {
      params.set("timeMin", new Date(Date.now() - 30 * 86_400_000).toISOString());
      params.set("singleEvents", "false");
    }
    if (pageToken) params.set("pageToken", pageToken);

    const data = await googleFetch<GoogleEventList>(
      `${CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      accessToken,
    );
    for (const event of data.items ?? []) {
      const result = await applyRemoteEvent(userId, event);
      if (result === "conflict") conflicts += 1;
      if (result === "added" || result === "updated" || result === "archived") pulled += 1;
    }
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) syncToken = data.nextSyncToken;
  } while (pageToken);

  await db.collection("calendar_integrations").updateOne({ userId }, { $set: { syncToken } });
  return { pulled, conflicts, syncToken };
}

export async function pushLocalChanges(
  userId: string,
  accessToken: string,
): Promise<{ pushed: number; conflicts: number }> {
  const db = await getDb();
  const tasks = await db
    .collection("tasks")
    .find({
      userId,
      calendarSyncState: "local",
      archived: false,
      dueDate: { $exists: true, $nin: [null, ""] },
    })
    .toArray();

  let pushed = 0;
  let conflicts = 0;
  for (const doc of tasks) {
    const task = doc as unknown as Task;
    try {
      const response = task.calendarEventId
        ? await googleFetch<GoogleEvent>(`${CALENDAR_API}/calendars/primary/events/${task.calendarEventId}`, accessToken, {
            method: "PUT",
            body: JSON.stringify(eventBody(task)),
          })
        : await googleFetch<GoogleEvent>(`${CALENDAR_API}/calendars/primary/events`, accessToken, {
            method: "POST",
            body: JSON.stringify(eventBody(task)),
          });
      await db.collection("tasks").updateOne(
        { userId, id: task.id },
        {
          $set: {
            calendarEventId: response.id,
            calendarSyncState: "synced",
            calendarUpdatedAt: response.updated ?? new Date().toISOString(),
            calendarSyncError: undefined,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      pushed += 1;
    } catch (error) {
      await db.collection("tasks").updateOne(
        { userId, id: task.id },
        {
          $set: {
            calendarSyncState: "conflict",
            calendarSyncError: error instanceof Error ? error.message.slice(0, 200) : "Sync failed",
          },
        },
      );
      conflicts += 1;
    }
  }
  return { pushed, conflicts };
}

export async function setupWatch(
  userId: string,
  integration: CalendarIntegration,
  accessToken: string,
): Promise<void> {
  const expires = integration.channelExpiration ? Date.parse(integration.channelExpiration) : 0;
  if (integration.channelId && expires > Date.now() + 86_400_000) return;

  if (integration.channelId) {
    try {
      await googleFetch(`${CALENDAR_API}/channels/stop`, accessToken, {
        method: "POST",
        body: JSON.stringify({ id: integration.channelId, resourceId: integration.channelResourceId }),
      });
    } catch {
      void 0;
    }
  }

  const id = randomUUID();
  const token = randomBytes(24).toString("hex");
  const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000;
  try {
    const channel = await googleFetch<GoogleChannel>(`${CALENDAR_API}/calendars/primary/events/watch`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        id,
        type: "web_hook",
        address: `${publicUrl()}/api/calendar/webhook`,
        token,
        expiration: String(expiration),
      }),
    });
    await upsertIntegration(userId, {
      channelId: id,
      channelResourceId: String(channel.resourceId ?? ""),
      channelToken: token,
      channelExpiration: new Date(Number(channel.expiration ?? expiration)).toISOString(),
    });
  } catch {
    await upsertIntegration(userId, { lastError: "Push notifications not active; manual sync still works" });
  }
}

export async function stopWatch(userId: string): Promise<void> {
  const integration = await getIntegration(userId);
  if (!integration?.channelId) return;
  try {
    const accessToken = await ensureAccessToken(userId, integration);
    await googleFetch(`${CALENDAR_API}/channels/stop`, accessToken, {
      method: "POST",
      body: JSON.stringify({ id: integration.channelId, resourceId: integration.channelResourceId }),
    });
  } catch {
    void 0;
  }
}

export async function syncCalendar(userId: string): Promise<SyncResult> {
  let integration = await getIntegration(userId);
  if (!integration) return { connected: false, pulled: 0, pushed: 0, conflicts: 0, syncToken: null };

  const accessToken = await ensureAccessToken(userId, integration);
  const remote = await pullRemoteChanges(userId, integration, accessToken);
  const local = await pushLocalChanges(userId, accessToken);
  integration = await getIntegration(userId);
  if (integration) await setupWatch(userId, integration, accessToken);

  const db = await getDb();
  await ensureIndexes(db);
  await db.collection("calendar_sync_logs").insertOne({
    userId,
    action: "sync",
    pulled: remote.pulled,
    pushed: local.pushed,
    conflicts: remote.conflicts + local.conflicts,
    timestamp: new Date(),
  });
  await upsertIntegration(userId, {
    status: "active",
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
  });

  return {
    connected: true,
    pulled: remote.pulled,
    pushed: local.pushed,
    conflicts: remote.conflicts + local.conflicts,
    syncToken: remote.syncToken,
  };
}

export async function integrationForChannel(channelId: string): Promise<CalendarIntegration | null> {
  const db = await getDb();
  await ensureIndexes(db);
  const doc = await db.collection("calendar_integrations").findOne({ channelId });
  return doc ? normalizeIntegration(doc as Record<string, unknown>) : null;
}

export async function resolveConflict(
  userId: string,
  taskId: string,
  choice: "local" | "google",
): Promise<void> {
  const db = await getDb();
  await ensureIndexes(db);
  const doc = await db.collection("tasks").findOne({ userId, id: taskId });
  if (!doc) return;

  if (choice === "local") {
    await db.collection("tasks").updateOne(
      { userId, id: taskId },
      { $set: { calendarSyncState: "local", calendarSyncError: undefined } },
    );
    return;
  }

  const integration = await getIntegration(userId);
  if (!integration) return;
  const accessToken = await ensureAccessToken(userId, integration);
  const eventId = asString(doc.calendarEventId);
  if (!eventId) {
    await db.collection("tasks").updateOne(
      { userId, id: taskId },
      { $set: { calendarSyncState: "local", calendarSyncError: undefined } },
    );
    return;
  }
  const event = await googleFetch<GoogleEvent>(`${CALENDAR_API}/calendars/primary/events/${eventId}`, accessToken);
  const dueDate = eventDate(event);
  await db.collection("tasks").updateOne(
    { userId, id: taskId },
    {
      $set: {
        title: String(event.summary ?? "Untitled event"),
        description: String(event.description ?? ""),
        dueDate,
        calendarSyncState: "synced",
        calendarUpdatedAt: String(event.updated ?? new Date().toISOString()),
        calendarSyncError: undefined,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}
