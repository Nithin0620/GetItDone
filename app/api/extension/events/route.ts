import { corsJson, optionsResponse } from "@/lib/cors";
import { userForToken } from "@/lib/extension-auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";

interface IncomingEvent {
  domain?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  activeSeconds?: number;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const userId = await userForToken(request);
  if (!userId) return corsJson({ error: "Invalid token" }, 401);

  const body = (await request.json()) as { events?: IncomingEvent[] };
  const events = (body.events ?? []).filter(
    (event) =>
      typeof event.domain === "string" &&
      event.domain.length <= 200 &&
      typeof event.startTime === "string" &&
      !Number.isNaN(Date.parse(event.startTime)) &&
      typeof event.activeSeconds === "number" &&
      event.activeSeconds > 0,
  );
  if (!events.length) return corsJson({ ok: true, count: 0 });

  const db = await getDb();
  await ensureIndexes(db);
  const rules = await db.collection("domain_rules").find({ userId }).toArray();
  const ruleMap = new Map(rules.map((rule) => [String(rule.domain), rule]));

  const documents = events.map((event) => {
    const rule = ruleMap.get(event.domain as string);
    return {
      userId,
      domain: event.domain,
      title: String(event.title ?? "").slice(0, 200),
      startTime: new Date(event.startTime as string),
      endTime: new Date(event.endTime ?? event.startTime as string),
      activeSeconds: Math.min(Math.round(event.activeSeconds as number), 86400),
      workspaceId: rule?.workspaceId ?? null,
      createdAt: new Date(),
    };
  });

  await db.collection("page_time_events").insertMany(documents);
  return corsJson({ ok: true, count: documents.length });
}
