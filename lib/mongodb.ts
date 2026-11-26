import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
export const mongoConfigured = Boolean(uri);

type MongoGlobal = typeof globalThis & {
  __getitdoneMongoClient?: Promise<MongoClient>;
};

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not configured");
  const globalForMongo = globalThis as MongoGlobal;
  if (!globalForMongo.__getitdoneMongoClient) {
    globalForMongo.__getitdoneMongoClient = new MongoClient(uri).connect();
  }
  return globalForMongo.__getitdoneMongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "getitdone");
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ userId: 1 }, { unique: true }),
    db.collection("workspaces").createIndex({ userId: 1 }),
    db.collection("tasks").createIndex({ userId: 1, workspaceId: 1 }),
    db.collection("tasks").createIndex({ userId: 1, dueDate: 1 }),
    db.collection("tasks").createIndex({ userId: 1, status: 1 }),
    db.collection("tags").createIndex({ userId: 1 }),
    db.collection("notes").createIndex({ userId: 1 }),
    db.collection("focus_sessions").createIndex({ userId: 1, startedAt: -1 }),
    db.collection("goals").createIndex({ userId: 1 }),
    db.collection("calendar_integrations").createIndex({ userId: 1, provider: 1 }, { unique: true }),
    db.collection("calendar_sync_logs").createIndex({ userId: 1, timestamp: -1 }),
    db.collection("calendar_integrations").createIndex({ userId: 1 }, { unique: true }),
    db.collection("calendar_oauth_states").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("tasks").createIndex({ userId: 1, calendarEventId: 1 }),
    db.collection("domain_rules").createIndex({ userId: 1, domain: 1 }),
    db.collection("extension_tokens").createIndex({ userId: 1 }),
    db.collection("extension_tokens").createIndex({ tokenHash: 1 }, { unique: true }),
  ]);

  try {
    await db.createCollection("page_time_events", {
      timeseries: { timeField: "startTime", metaField: "userId", granularity: "minutes" },
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 48) throw error;
  }
  await db.collection("page_time_events").createIndex({ userId: 1, startTime: -1 });
  await db.collection("page_time_events").createIndex({ domain: 1 });
}
