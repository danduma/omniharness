import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";

interface StoredSetting {
  key: string;
  value: string;
}

export interface RuntimeSettingDecryptionFailure {
  key: string;
}

function isRuntimeEnvSettingKey(key: string) {
  return /^[A-Z][A-Z0-9_]*$/.test(key);
}

export function hydrateRuntimeEnvFromSettings(settings: StoredSetting[]) {
  const env: Record<string, string> = {};
  const decryptionFailures: RuntimeSettingDecryptionFailure[] = [];

  for (const setting of settings) {
    if (!isRuntimeEnvSettingKey(setting.key)) {
      continue;
    }

    if (!shouldEncryptSetting(setting.key)) {
      env[setting.key] = setting.value;
      continue;
    }

    try {
      env[setting.key] = decryptSettingValue(setting.value);
    } catch (error) {
      console.warn(`Unable to decrypt runtime setting "${setting.key}":`, error);
      decryptionFailures.push({ key: setting.key });
    }
  }

  return { env, decryptionFailures };
}

export async function readRuntimeEnvFromSettings() {
  const allSettings = await db.select().from(settings);
  return hydrateRuntimeEnvFromSettings(allSettings);
}
