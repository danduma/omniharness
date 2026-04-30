import { getSettingsKeyPath } from "@/server/settings/crypto";
import type { RuntimeSettingDecryptionFailure } from "@/server/supervisor/runtime-settings";

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FALLBACK_PROVIDER = "openai";
const DEFAULT_FALLBACK_MODEL = "gpt-5.4-mini";

type EnvLike = Record<string, string | undefined>;

interface ModelConfig {
  provider: string;
  model: string;
  apiKey: string | undefined;
  baseURL: string | undefined;
  source: "primary" | "fallback";
}

function fallbackApiKey(provider: string, env: EnvLike) {
  switch (provider) {
    case "gemini":
      return env.GEMINI_API_KEY?.trim();
    case "anthropic":
      return env.ANTHROPIC_API_KEY?.trim();
    case "openai":
      return env.OPENAI_API_KEY?.trim();
    default:
      return undefined;
  }
}

function fallbackApiKeySetting(provider: string) {
  switch (provider) {
    case "gemini":
      return "GEMINI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    default:
      return null;
  }
}

function formatSettingChoices(settingNames: string[]) {
  if (settingNames.length === 1) {
    return settingNames[0];
  }

  if (settingNames.length === 2) {
    return `${settingNames[0]} or ${settingNames[1]}`;
  }

  return `${settingNames.slice(0, -1).join(", ")}, or ${settingNames.at(-1)}`;
}

export function getSupervisorModelConfig(env: EnvLike) {
  const primaryProvider = env.SUPERVISOR_LLM_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const fallbackProvider = env.SUPERVISOR_FALLBACK_LLM_PROVIDER?.trim() || DEFAULT_FALLBACK_PROVIDER;

  const primaryConfig: ModelConfig = {
    provider: primaryProvider,
    model: env.SUPERVISOR_LLM_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: env.SUPERVISOR_LLM_API_KEY?.trim() || fallbackApiKey(primaryProvider, env),
    baseURL: env.SUPERVISOR_LLM_BASE_URL?.trim() || undefined,
    source: "primary",
  };

  const fallbackConfig: ModelConfig = {
    provider: fallbackProvider,
    model: env.SUPERVISOR_FALLBACK_LLM_MODEL?.trim() || DEFAULT_FALLBACK_MODEL,
    apiKey: env.SUPERVISOR_FALLBACK_LLM_API_KEY?.trim() || fallbackApiKey(fallbackProvider, env),
    baseURL: env.SUPERVISOR_FALLBACK_LLM_BASE_URL?.trim() || undefined,
    source: "fallback",
  };

  return primaryConfig.apiKey ? primaryConfig : fallbackConfig.apiKey ? fallbackConfig : primaryConfig;
}

export function validateSupervisorModelConfig(
  config: ReturnType<typeof getSupervisorModelConfig>,
  decryptionFailures: RuntimeSettingDecryptionFailure[],
) {
  if (config.apiKey) {
    return config;
  }

  const relevantSettings =
    config.source === "fallback"
      ? ["SUPERVISOR_FALLBACK_LLM_API_KEY"]
      : ["SUPERVISOR_LLM_API_KEY", "SUPERVISOR_FALLBACK_LLM_API_KEY"];
  const providerApiKeySetting = fallbackApiKeySetting(config.provider);
  if (providerApiKeySetting && !relevantSettings.includes(providerApiKeySetting)) {
    relevantSettings.push(providerApiKeySetting);
  }

  const failedSetting = decryptionFailures.find((failure) => relevantSettings.includes(failure.key));
  if (failedSetting) {
    throw new Error(
      `Supervisor API key is unavailable because stored setting "${failedSetting.key}" could not be decrypted. ` +
      `Re-enter it in Settings or restore the settings key at ${getSettingsKeyPath()}.`,
    );
  }

  throw new Error(
    `Supervisor model "${config.model}" for provider "${config.provider}" has no API key configured. ` +
    `Set ${formatSettingChoices(relevantSettings)} in Settings.`,
  );
}

function toMastraProvider(provider: string) {
  return provider === "gemini" ? "google" : provider;
}

export function buildMastraModelConfig(config: ReturnType<typeof getSupervisorModelConfig>) {
  const id = `${toMastraProvider(config.provider)}/${config.model}` as `${string}/${string}`;

  return {
    id,
    apiKey: config.apiKey,
    url: config.baseURL,
  };
}
