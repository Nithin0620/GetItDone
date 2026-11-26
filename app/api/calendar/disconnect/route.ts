import { auth } from "@/auth";
import { stopWatch } from "@/lib/google-calendar";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await stopWatch(session.user.id);
  const db = await getDb();
  await ensureIndexes(db);
  await db.collection("calendar_integrations").deleteOne({ userId: session.user.id });
  await db.collection("calendar_oauth_states").deleteMany({ userId: session.user.id });
  await db.collection("tasks").updateMany(
    { userId: session.user.id },
    {
      $set: { calendarSyncState: "local", updatedAt: new Date().toISOString() },
      $unset: { calendarEventId: "", calendarUpdatedAt: "", calendarSyncError: "" },
    },
  );
  return NextResponse.json({ ok: true });
}
