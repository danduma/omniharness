import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { accounts } from '@/server/db/schema';
import { requireApiSession } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, {
    source: "Accounts",
    action: "Load accounts",
  });
  if (auth.response) {
    return auth.response;
  }

  const allAccounts = await db.select().from(accounts);
  return NextResponse.json(allAccounts);
}
