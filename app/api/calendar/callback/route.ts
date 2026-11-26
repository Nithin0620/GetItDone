import { auth } from "@/auth";
import {
  getIntegration,
  oauthConfig,
  publicUrl,
  stopWatch,
  syncCalendar,
  upsertIntegration,
} from "@/lib/google-calendar";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${publicUrl()}/settings?calendar=unauthorized`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("calendar_state="))
    ?.slice("calendar_state=".length);
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(`${publicUrl()}/settings?calendar=error`);
  }

  const db = await getDb();
  await ensureIndexes(db);
  const stateDoc = await db.collection("calendar_oauth_states").findOneAndDelete({
    userId: session.user.id,
    state,
    expiresAt: { $gt: new Date() },
  });
  if (!stateDoc) return NextResponse.redirect(`${publicUrl()}/settings?calendar=error`);

  const config = oauthConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenResponse.ok) return NextResponse.redirect(`${publicUrl()}/settings?calendar=error`);
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  const existing = await getIntegration(session.user.id);
  if (existing?.channelId) await stopWatch(session.user.id);
  const now = new Date().toISOString();
  await upsertIntegration(session.user.id, {
    provider: "google",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope ?? config.scope,
    calendarId: "primary",
    syncToken: null,
    channelId: null,
    channelResourceId: null,
    channelToken: null,
    channelExpiration: null,
    connectedAt: existing?.connectedAt ?? now,
    lastSyncedAt: null,
    status: "active",
    lastError: null,
  });

  try {
    await syncCalendar(session.user.id);
  } catch {
    void 0;
  }

  const response = NextResponse.redirect(`${publicUrl()}/settings?calendar=connected`);
  response.cookies.delete("calendar_state");
  return response;
}
