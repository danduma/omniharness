import { decryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";

interface StoredSetting {
  key: string;
  value: string;
}

export interface RuntimeSettingDecryptionFailure {
  key: string;
}

export function hydrateRuntimeEnvFromSettings(settings: StoredSetting[]) {
  const env: Record<string, string> = {};
  const decryptionFailures: RuntimeSettingDecryptionFailure[] = [];

  for (const setting of settings) {
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
