import { db } from "@/server/db";
import { messages } from "@/server/db/schema";
import { requireApiSession } from "@/server/auth/guards";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { asc } from "drizzle-orm";

export const handleMessagesRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  const auth = await requireApiSession(toNextRequest(request), {
    source: "Messages",
    action: "Load messages",
  });
  if (auth.response) {
    return auth.response;
  }

  const allMessages = await db.select().from(messages).orderBy(asc(messages.createdAt), asc(messages.id));
  return Response.json(allMessages.map(serializeMessageRecord));
};
