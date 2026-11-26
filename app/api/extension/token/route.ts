import { auth } from "@/auth";
import { corsJson, optionsResponse } from "@/lib/cors";
import { hashToken } from "@/lib/extension-auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { randomBytes } from "node:crypto";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return corsJson({ error: "Unauthorized" }, 401);

  const db = await getDb();
  await ensureIndexes(db);
  const userId = session.user.id;
  const existing = await db
    .collection("extension_tokens")
    .findOne({ userId, revokedAt: null }, { sort: { createdAt: -1 } });

  if (existing) {
    return corsJson({ token: null, configured: true, createdAt: existing.createdAt });
  }

  const token = randomBytes(32).toString("hex");
  await db.collection("extension_tokens").insertOne({
    userId,
    tokenHash: hashToken(token),
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  });
  return corsJson({ token, configured: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return corsJson({ error: "Unauthorized" }, 401);

  const db = await getDb();
  await ensureIndexes(db);
  await db.collection("extension_tokens").updateMany(
    { userId: session.user.id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return corsJson({ ok: true });
}
