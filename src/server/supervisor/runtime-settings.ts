import { decryptSettingValue, shouldEncryptSetting } from "@/server/settings/crypto";

interface StoredSetting {
  key: string;
  value: string;
}

export function hydrateRuntimeEnvFromSettings(settings: StoredSetting[]) {
  const env: Record<string, string> = {};

  for (const setting of settings) {
    try {
      env[setting.key] = decryptSettingValue(setting.value);
    } catch (error) {
      console.warn(`Unable to decrypt runtime setting "${setting.key}":`, error);
      if (!shouldEncryptSetting(setting.key)) {
        env[setting.key] = setting.value;
      }
    }
  }

  return env;
}
