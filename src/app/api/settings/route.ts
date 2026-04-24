import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue, encryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";
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

      try {
        return [[setting.key, decryptSettingValue(setting.value)]];
      } catch (error) {
        console.warn(`Unable to decrypt setting "${setting.key}":`, error);
        diagnostics.push(buildAppError(
          `Unable to decrypt setting "${setting.key}".`,
          {
            source: "Settings",
            action: "Load saved settings",
          },
        ));
        return [[setting.key, ""]];
      }
    }));

    return NextResponse.json({ values, diagnostics });
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
        const storedValue = shouldEncryptSetting(key) ? encryptSettingValue(value) : value;
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
