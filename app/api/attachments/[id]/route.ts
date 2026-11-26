import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ownedFile(id: string, userId: string) {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  await ensureIndexes(db);
  const objectId = new ObjectId(id);
  const file = await db.collection("attachments.files").findOne({ _id: objectId });
  if (!file || file.metadata?.userId !== userId) return null;
  return { db, objectId, file };
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await ownedFile(id, session.user.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = new GridFSBucket(owned.db, { bucketName: "attachments" });
  const chunks = await new Promise<Buffer[]>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = bucket.openDownloadStream(owned.objectId);
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)));
    stream.on("end", () => resolve(chunks));
    stream.on("error", reject);
  });

  return new Response(Buffer.concat(chunks), {
    headers: {
      "Content-Type": String(owned.file.contentType ?? owned.file.metadata?.contentType ?? "application/octet-stream")
,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(String(owned.file.filename ?? "attachment"))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await ownedFile(id, session.user.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = new GridFSBucket(owned.db, { bucketName: "attachments" });
  await bucket.delete(owned.objectId);
  return NextResponse.json({ ok: true });
}
