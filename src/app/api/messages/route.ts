import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { messages } from '@/server/db/schema';

export async function GET() {
  const allMessages = await db.select().from(messages).orderBy(messages.createdAt);
  return NextResponse.json(allMessages);
}
