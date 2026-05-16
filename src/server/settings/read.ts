import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { buildAppError } from "@/server/api-errors";
import { decryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";
import { canonicalizePersistedProjectRoots } from "@/server/projects/canonicalize";
import type { SettingsResponse } from "@/app/home/types";

function isInternalSettingKey(key: string) {
  return key.startsWith("__");
}

function buildSecretPreview(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) {
    return "•".repeat(Math.max(4, trimmed.length));
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
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

    const configured = setting.value.trim().length > 0;
    let preview: string | undefined;
    if (configured) {
      try {
        preview = buildSecretPreview(decryptSettingValue(setting.value));
      } catch {
        preview = undefined;
      }
    }

    return [[setting.key, {
      configured,
      updatedAt: new Date(setting.updatedAt).toISOString(),
      preview,
    }]];
  }));

  return { values, secrets, diagnostics };
}
