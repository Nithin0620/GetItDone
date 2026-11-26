import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { oauthConfig, publicUrl } from "@/lib/google-calendar";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${publicUrl()}/settings?calendar=unauthorized`);

  const config = oauthConfig();
  const state = randomBytes(24).toString("hex");
  const db = await getDb();
  await ensureIndexes(db);
  await db.collection("calendar_oauth_states").insertOne({
    userId: session.user.id,
    state,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("calendar_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: publicUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return response;
}
