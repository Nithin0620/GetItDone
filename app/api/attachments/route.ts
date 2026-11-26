import { auth } from "@/auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ items: [] });

  const db = await getDb();
  await ensureIndexes(db);
  const files = await db
    .collection("attachments.files")
    .find({ "metadata.userId": session.user.id, "metadata.taskId": taskId })
    .sort({ uploadDate: -1 })
    .toArray();

  return NextResponse.json({
    items: files.map((file) => ({
      id: file._id.toString(),
      name: String(file.filename ?? "file"),
      size: Number(file.length ?? 0),
      contentType: String(file.contentType ?? file.metadata?.contentType ?? "application/octet-stream"),
      uploadedAt: String(file.metadata?.uploadedAt ?? file.uploadDate ?? ""),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!(file instanceof File) || !taskId) {
    return NextResponse.json({ error: "File and task are required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Files must be under 10 MB" }, { status: 413 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const bucket = new GridFSBucket(db, { bucketName: "attachments" });
  const buffer = Buffer.from(await file.arrayBuffer());
  const id = await new Promise<ObjectId>((resolve, reject) => {
    const stream = bucket.openUploadStream(file.name || "attachment", {
      metadata: {
        userId: session.user.id,
        taskId,
        contentType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      },
    });
    stream.on("finish", () => resolve(stream.id));
    stream.on("error", reject);
    stream.end(buffer);
  });

  return NextResponse.json({ id: id.toString(), name: file.name, size: file.size }, { status: 201 });
}
