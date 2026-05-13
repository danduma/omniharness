import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { buildAppError } from "@/server/api-errors";
import { shouldEncryptSetting } from "@/server/settings/crypto";
import { canonicalizePersistedProjectRoots } from "@/server/projects/canonicalize";
import type { SettingsResponse } from "@/app/home/types";

function isInternalSettingKey(key: string) {
  return key.startsWith("__");
}

export async function readSettingsState(): Promise<SettingsResponse> {
  const allSettings = await db.select().from(settings);
  const projectSetting = allSettings.find((setting) => setting.key === "PROJECTS");
  if (projectSetting) {
    await canonicalizePersistedProjectRoots(projectSetting.value);
  }
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

  return { values, secrets, diagnostics };
}
