import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const items = await db
    .collection("page_time_events")
    .aggregate([
      { $match: { userId: session.user.id, startTime: { $gte: since } } },
      {
        $group: {
          _id: {
            domain: "$domain",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
          },
          seconds: { $sum: "$activeSeconds" },
        },
      },
      {
        $project: {
          _id: 0,
          domain: "$_id.domain",
          day: "$_id.day",
          seconds: 1,
        },
      },
      { $sort: { seconds: -1 } },
      { $limit: 200 },
    ])
    .toArray();

  return NextResponse.json({ items });
}
