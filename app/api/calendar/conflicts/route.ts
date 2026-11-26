import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  await ensureIndexes(db);
  const docs = await db
    .collection("tasks")
    .find(
      { userId: session.user.id, calendarSyncState: "conflict" },
      { projection: { id: 1, title: 1, calendarSyncError: 1 } },
    )
    .toArray();

  return NextResponse.json({
    items: docs.map((doc) => ({
      id: String(doc.id),
      title: String(doc.title ?? ""),
      error: typeof doc.calendarSyncError === "string" ? doc.calendarSyncError : null,
    })),
  });
}
