import { NextResponse } from "next/server";
import { readCodexCredentialsSync } from "@/server/supervisor/codex-auth";

export async function GET() {
  const creds = readCodexCredentialsSync();
  
  if (!creds) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({
    available: true,
    email: creds.email,
    planType: creds.planType,
    expiresAt: creds.expiresAt,
    subscriptionActiveUntil: creds.subscriptionActiveUntil,
    lastRefresh: creds.lastRefresh,
  });
}
