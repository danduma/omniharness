import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { accounts } from '@/server/db/schema';

export async function GET() {
  const allAccounts = await db.select().from(accounts);
  return NextResponse.json(allAccounts);
}
