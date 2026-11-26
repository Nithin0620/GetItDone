import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { normalizeState, seedState } from "@/lib/seed";
import { tasksCsv } from "@/lib/export";
import type { AppState, DomainRule, FocusSession, Goal, Note, Tag, Task, Workspace } from "@/lib/types";
import { todayKey } from "@/lib/utils";
import { NextResponse } from "next/server";

function clean<T>(doc: Record<string, unknown>): T {
  const copy = { ...doc };
  delete copy._id;
  delete copy.userId;
  return copy as T;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  await ensureIndexes(db);
  const userId = session.user.id;
  const [workspaces, tasks, notes, tags, focusSessions, goals, domainRules, userDoc] = await Promise.all([
    db.collection("workspaces").find({ userId }).toArray(),
    db.collection("tasks").find({ userId }).toArray(),
    db.collection("notes").find({ userId }).toArray(),
    db.collection("tags").find({ userId }).toArray(),
    db.collection("focus_sessions").find({ userId }).toArray(),
    db.collection("goals").find({ userId }).toArray(),
    db.collection("domain_rules").find({ userId }).toArray(),
    db.collection("users").findOne({ userId }),
  ]);

  const state: AppState = normalizeState({
    workspaces: workspaces.map((doc) => clean<Workspace>(doc as Record<string, unknown>)),
    tasks: tasks.map((doc) => clean<Task>(doc as Record<string, unknown>)),
    notes: notes.map((doc) => clean<Note>(doc as Record<string, unknown>)),
    tags: tags.map((doc) => clean<Tag>(doc as Record<string, unknown>)),
    focusSessions: focusSessions.map((doc) => clean<FocusSession>(doc as Record<string, unknown>)),
    goals: goals.map((doc) => clean<Goal>(doc as Record<string, unknown>)),
    domainRules: domainRules.map((doc) => clean<DomainRule>(doc as Record<string, unknown>)),
    settings: (userDoc?.settings ?? seedState().settings) as AppState["settings"],
  });

  const isCsv = new URL(request.url).searchParams.get("format") === "csv";
  const content = isCsv ? tasksCsv(state) : JSON.stringify(state, null, 2);
  const filename = isCsv
    ? `getitdone-tasks-${todayKey()}.csv`
    : `getitdone-${todayKey()}.json`;

  return new Response(content, {
    headers: {
      "Content-Type": isCsv ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
