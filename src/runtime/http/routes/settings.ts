import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { buildAppError, errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { canonicalizePersistedProjectRoots } from "@/server/projects/canonicalize";
import { encryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";
import { updateRuntimeSettings } from "@/server/bridge-client";
import { emitNamedEvent } from "@/server/events/named-events";
import { readSystemResourceSnapshot } from "@/server/agent-runtime/resource-admission";
import { RUNTIME_RESOURCE_SETTING_KEYS } from "@/lib/runtime-resource-settings";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

function isInternalSettingKey(key: string) {
  return key.startsWith("__");
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function getSettings(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Settings",
    action: "Load saved settings",
  });
  if (auth.response) {
    return auth.response;
  }

  const allSettings = await db.select().from(settings);
  // canonicalizePersistedProjectRoots is a one-shot fixup over all runs +
  // workers that does sync fs.existsSync and serial db.update per drifted
  // row. Running it on every GET (which is polled by React Query and SSE
  // reconnects) was costing 30-60s with a large run history and saturating
  // the event loop. Canonicalization only matters when PROJECTS changes —
  // which happens on POST.
  const diagnostics: ReturnType<typeof buildAppError>[] = [];
  const values = Object.fromEntries(allSettings.flatMap((setting) => {
    if (isInternalSettingKey(setting.key)) {
      return [];
    }

    if (!shouldEncryptSetting(setting.key)) {
      return [[setting.key, setting.value]];
    }

    return [];
  }));
  const secrets = Object.fromEntries(allSettings.flatMap((setting) => {
    if (isInternalSettingKey(setting.key)) {
      return [];
    }

    if (!shouldEncryptSetting(setting.key)) {
      return [];
    }

    return [[setting.key, {
      configured: setting.value.trim().length > 0,
      updatedAt: new Date(setting.updatedAt).toISOString(),
    }]];
  }));

  const resourceSnapshot = await readSystemResourceSnapshot(process.cwd());

  return Response.json({ values, secrets, diagnostics, resourceSnapshot });
}

async function postSettings(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Settings",
    action: "Save settings",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  let projectSettingValue: string | null = null;
  const runtimeResourceSettings: Record<string, string> = {};
  const runtimeResourceKeys = new Set<string>(Object.values(RUNTIME_RESOURCE_SETTING_KEYS));
  for (const [key, value] of Object.entries(body)) {
    if (isInternalSettingKey(key)) {
      continue;
    }

    if (typeof value === "string") {
      if (key === "PROJECTS") {
        projectSettingValue = value;
      }
      if (runtimeResourceKeys.has(key)) {
        runtimeResourceSettings[key] = value;
      }
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
  if (projectSettingValue !== null) {
    await canonicalizePersistedProjectRoots(projectSettingValue);
  }
  if (Object.keys(runtimeResourceSettings).length > 0) {
    try {
      await updateRuntimeSettings(runtimeResourceSettings);
    } catch (error) {
      const keys = Object.keys(runtimeResourceSettings);
      const reason = describeError(error);
      emitNamedEvent({ kind: "runtime.settings_apply_failed", keys, reason });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "runtime.settings_apply_failed",
        message: `Runtime settings were saved, but the running agent runtime did not apply them yet: ${reason}`,
        surface: "log",
      });
    }
  }
  return Response.json({ ok: true });
}

export const handleSettingsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") {
      return getSettings(request);
    }
    if (request.method === "POST") {
      return postSettings(request);
    }
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, POST" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Settings",
      action: request.method === "POST" ? "Save settings" : "Load saved settings",
    });
  }
};
