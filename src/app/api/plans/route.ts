import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { plans } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req?: NextRequest) {
  const auth = await requireApiSession(req, {
    source: "Plans",
    action: "Load plans",
  });
  if (auth.response) {
    return auth.response;
  }

  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
  return NextResponse.json(allPlans);
}
