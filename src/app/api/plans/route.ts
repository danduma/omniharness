import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { plans } from '@/server/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
  return NextResponse.json(allPlans);
}
