import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { encryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";
import { buildAppError, errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Settings",
      action: "Load saved settings",
    });
    if (auth.response) {
      return auth.response;
    }

    const allSettings = await db.select().from(settings);
    const diagnostics: ReturnType<typeof buildAppError>[] = [];
    const values = Object.fromEntries(allSettings.flatMap((setting) => {
      if (!shouldEncryptSetting(setting.key)) {
        return [[setting.key, setting.value]];
      }

      return [];
    }));
    const secrets = Object.fromEntries(allSettings.flatMap((setting) => {
      if (!shouldEncryptSetting(setting.key)) {
        return [];
      }

      return [[setting.key, {
        configured: setting.value.trim().length > 0,
        updatedAt: new Date(setting.updatedAt).toISOString(),
      }]];
    }));

    return NextResponse.json({ values, secrets, diagnostics });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Settings",
      action: "Load saved settings",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Settings",
      action: "Save settings",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        const isSecret = shouldEncryptSetting(key);
        if (isSecret && value.trim() === "") {
          const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
          if (existing) {
            continue;
          }
        }

        const storedValue = isSecret ? encryptSettingValue(value) : value;
        await db.insert(settings)
          .values({ key, value: storedValue, updatedAt: new Date() })
          .onConflictDoUpdate({ target: settings.key, set: { value: storedValue, updatedAt: new Date() } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return errorResponse(err, {
      status: 500,
      source: "Settings",
      action: "Save settings",
    });
  }
}
