import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { messages } from '@/server/db/schema';
import { requireApiSession } from "@/server/auth/guards";
import { serializeMessageRecord } from "@/server/conversations/message-records";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, {
    source: "Messages",
    action: "Load messages",
  });
  if (auth.response) {
    return auth.response;
  }

  const allMessages = await db.select().from(messages).orderBy(messages.createdAt);
  return NextResponse.json(allMessages.map(serializeMessageRecord));
}
