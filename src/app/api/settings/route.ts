import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const dict = Object.fromEntries(allSettings.map(s => [s.key, s.value]));
  return NextResponse.json(dict);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        await db.insert(settings)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
