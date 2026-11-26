import { integrationForChannel, isCalendarAutosyncEnabled, syncCalendar } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id") ?? "";
  const channelToken = request.headers.get("x-goog-channel-token") ?? "";
  const resourceState = request.headers.get("x-goog-resource-state") ?? "";
  const integration = channelId ? await integrationForChannel(channelId) : null;

  if (!integration || integration.channelToken !== channelToken) {
    return NextResponse.json({ ok: true });
  }
  if (resourceState === "sync" || resourceState === "exists") {
    return NextResponse.json({ ok: true });
  }

  if (!(await isCalendarAutosyncEnabled(integration.userId))) {
    return NextResponse.json({ ok: true });
  }

  try {
    await syncCalendar(integration.userId);
  } catch {
    void 0;
  }
  return NextResponse.json({ ok: true });
}
