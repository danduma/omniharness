import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const dict = Object.fromEntries(allSettings.map(s => [s.key, decryptSettingValue(s.value)]));
  return NextResponse.json(dict);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        const encryptedValue = encryptSettingValue(value);
        await db.insert(settings)
          .values({ key, value: encryptedValue, updatedAt: new Date() })
          .onConflictDoUpdate({ target: settings.key, set: { value: encryptedValue, updatedAt: new Date() } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
