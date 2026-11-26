import { corsJson, optionsResponse } from "@/lib/cors";
import { userForToken } from "@/lib/extension-auth";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import type { DomainRule } from "@/lib/types";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const userId = await userForToken(request);
  if (!userId) return corsJson({ error: "Invalid token" }, 401);

  const db = await getDb();
  await ensureIndexes(db);
  const [rules, userDoc, running] = await Promise.all([
    db.collection("domain_rules").find({ userId }).toArray(),
    db.collection("users").findOne({ userId }),
    db.collection("focus_sessions").countDocuments({ userId, endedAt: { $exists: false } }),
  ]);

  return corsJson({
    domainRules: rules.map(
      (doc) =>
        ({
          id: String(doc.id ?? doc._id),
          domain: String(doc.domain),
          workspaceId: doc.workspaceId ?? null,
          category: doc.category ?? undefined,
          budgetMinutesPerDay: doc.budgetMinutesPerDay ?? undefined,
          blockedDuringFocus: Boolean(doc.blockedDuringFocus),
        }) satisfies DomainRule,
    ),
    focusActive: running > 0,
    settings: userDoc?.settings ?? null,
  });
}
