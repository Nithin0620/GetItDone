import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { normalizeState, seedState } from "@/lib/seed";
import type {
  AppState,
  DomainRule,
  FocusSession,
  Goal,
  Note,
  Settings,
  Tag,
  Task,
  Workspace,
} from "@/lib/types";
import { NextResponse } from "next/server";
import type { Document, WithId } from "mongodb";

async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

function clean<T>(doc: WithId<Document>): T {
  const copy = { ...doc } as Record<string, unknown>;
  delete copy._id;
  delete copy.userId;
  return copy as T;
}

function owned<T extends object>(items: T[], userId: string): Record<string, unknown>[] {
  return items.map((item) => ({ ...(item as unknown as Record<string, unknown>), userId }));
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  await ensureIndexes(db);

  let userDoc = await db.collection("users").findOne({ userId });
  if (!userDoc) {
    const seed = seedState();
    await db.collection("users").insertOne({
      userId,
      googleId: userId,
      settings: seed.settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Promise.all([
      db.collection("workspaces").insertMany(owned(seed.workspaces, userId)),
      db.collection("tasks").insertMany(owned(seed.tasks, userId)),
      db.collection("notes").insertMany(owned(seed.notes, userId)),
      db.collection("tags").insertMany(owned(seed.tags, userId)),
      db.collection("focus_sessions").insertMany(owned(seed.focusSessions, userId)),
      db.collection("goals").insertMany(owned(seed.goals, userId)),
      db.collection("domain_rules").insertMany(owned(seed.domainRules, userId)),
    ]);
    userDoc = await db.collection("users").findOne({ userId });
  }

  const [workspaces, tasks, notes, tags, focusSessions, goals, domainRules] = await Promise.all([
    db.collection("workspaces").find({ userId }).sort({ order: 1 }).toArray(),
    db.collection("tasks").find({ userId }).sort({ order: 1 }).toArray(),
    db.collection("notes").find({ userId }).toArray(),
    db.collection("tags").find({ userId }).toArray(),
    db.collection("focus_sessions").find({ userId }).toArray(),
    db.collection("goals").find({ userId }).toArray(),
    db.collection("domain_rules").find({ userId }).toArray(),
  ]);

  const state: AppState = normalizeState({
    version: 1,
    workspaces: workspaces.map((doc) => clean<Workspace>(doc)),
    tasks: tasks.map((doc) => clean<Task>(doc)),
    notes: notes.map((doc) => clean<Note>(doc)),
    tags: tags.map((doc) => clean<Tag>(doc)),
    focusSessions: focusSessions.map((doc) => clean<FocusSession>(doc)),
    goals: goals.map((doc) => clean<Goal>(doc)),
    domainRules: domainRules.map((doc) => clean<DomainRule>(doc)),
    settings: (userDoc?.settings as Settings | undefined) ?? seedState().settings,
  });

  return NextResponse.json({ state });
}

export async function PUT(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { state?: Partial<AppState> };
  if (!body.state || body.state.version !== 1) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }
  const state = normalizeState(body.state);

  const db = await getDb();
  await ensureIndexes(db);

  const replace = async (name: string, items: Record<string, unknown>[]) => {
    const collection = db.collection(name);
    await collection.deleteMany({ userId });
    if (items.length) await collection.insertMany(items);
  };

  await Promise.all([
    replace("workspaces", owned(state.workspaces, userId)),
    replace("tasks", owned(state.tasks, userId)),
    replace("notes", owned(state.notes, userId)),
    replace("tags", owned(state.tags, userId)),
    replace("focus_sessions", owned(state.focusSessions, userId)),
    replace("goals", owned(state.goals, userId)),
    replace("domain_rules", owned(state.domainRules, userId)),
    db.collection("users").updateOne(
      { userId },
      { $set: { settings: state.settings, updatedAt: new Date() } },
      { upsert: true },
    ),
  ]);

  return NextResponse.json({ ok: true });
}
