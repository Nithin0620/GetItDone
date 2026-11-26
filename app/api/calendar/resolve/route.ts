import { auth } from "@/auth";
import { resolveConflict, syncCalendar } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { taskId?: string; choice?: "local" | "google" };
  if (!body.taskId || (body.choice !== "local" && body.choice !== "google")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await resolveConflict(session.user.id, body.taskId, body.choice);
  if (body.choice === "local") await syncCalendar(session.user.id);
  return NextResponse.json({ ok: true });
}
