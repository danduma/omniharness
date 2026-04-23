import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { authEvents } from "@/server/db/schema";

export async function insertAuthEvent(args: {
  eventType: string;
  sessionId?: string | null;
  pairTokenId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  await db.insert(authEvents).values({
    id: randomUUID(),
    sessionId: args.sessionId ?? null,
    pairTokenId: args.pairTokenId ?? null,
    eventType: args.eventType,
    details: args.details ? JSON.stringify(args.details) : null,
    createdAt: new Date(),
  });
}
