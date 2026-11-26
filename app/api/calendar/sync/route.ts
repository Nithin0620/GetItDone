import { auth } from "@/auth";
import { syncCalendar } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncCalendar(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message.slice(0, 200) : "Sync failed" },
      { status: 500 },
    );
  }
}
