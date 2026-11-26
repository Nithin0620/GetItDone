import { createHash } from "node:crypto";
import { ensureIndexes, getDb } from "@/lib/mongodb";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function userForToken(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const db = await getDb();
  await ensureIndexes(db);
  const doc = await db.collection("extension_tokens").findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
  });
  if (!doc) return null;

  await db.collection("extension_tokens").updateOne(
    { _id: doc._id },
    { $set: { lastUsedAt: new Date() } },
  );
  return doc.userId as string;
}
