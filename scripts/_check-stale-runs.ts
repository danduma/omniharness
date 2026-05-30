import { db } from "@/server/db";
import { runs, messages, conversationReadMarkers } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

const ids = ["7048f1e07877", "e16f31e91c73", "13165a11-e7f5-4283-a6c5-7d8ea97ba319"];

async function main() {
  const r = await db.select({ id: runs.id, status: runs.status, updatedAt: runs.updatedAt, title: runs.title })
    .from(runs).where(inArray(runs.id, ids));
  console.log("RUNS:", JSON.stringify(r, null, 2));

  const m = await db.select({ runId: conversationReadMarkers.runId, lastReadAt: conversationReadMarkers.lastReadAt })
    .from(conversationReadMarkers).where(inArray(conversationReadMarkers.runId, ids));
  console.log("READ_MARKERS:", JSON.stringify(m, null, 2));

  const msgs = await db.select({ runId: messages.runId, role: messages.role, createdAt: messages.createdAt })
    .from(messages).where(inArray(messages.runId, ids));
  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
