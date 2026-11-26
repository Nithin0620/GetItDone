import { authEnabled } from "@/auth";
import { mongoConfigured } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    auth: authEnabled,
    mongo: mongoConfigured,
  });
}
