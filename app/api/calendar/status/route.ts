import { auth } from "@/auth";
import { getIntegration } from "@/lib/google-calendar";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await getIntegration(session.user.id);
  const db = await getDb();
  await ensureIndexes(db);
  const conflicts = await db.collection("tasks").countDocuments({
    userId: session.user.id,
    calendarSyncState: "conflict",
  });

  return NextResponse.json({
    connected: Boolean(integration),
    status: integration?.status ?? "disconnected",
    lastSyncedAt: integration?.lastSyncedAt ?? null,
    channelExpiration: integration?.channelExpiration ?? null,
    lastError: integration?.lastError ?? null,
    conflicts,
  });
}
