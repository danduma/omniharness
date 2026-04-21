import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue, encryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const dict = Object.fromEntries(allSettings.flatMap((setting) => {
    if (!shouldEncryptSetting(setting.key)) {
      return [[setting.key, setting.value]];
    }

    try {
      return [[setting.key, decryptSettingValue(setting.value)]];
    } catch (error) {
      console.warn(`Unable to decrypt setting "${setting.key}":`, error);
      return [[setting.key, ""]];
    }
  }));
  return NextResponse.json(dict);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        const storedValue = shouldEncryptSetting(key) ? encryptSettingValue(value) : value;
        await db.insert(settings)
          .values({ key, value: storedValue, updatedAt: new Date() })
          .onConflictDoUpdate({ target: settings.key, set: { value: storedValue, updatedAt: new Date() } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
