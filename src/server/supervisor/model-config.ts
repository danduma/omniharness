import { getSettingsKeyPath } from "@/server/settings/crypto";
import type { RuntimeSettingDecryptionFailure } from "@/server/supervisor/runtime-settings";
import { readCodexCredentialsSync, ensureFreshCodexCredentials, CodexAuthMissingError, CodexAuthRefreshFailedError } from "./codex-auth";
import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_PROVIDER = "openai";
const DEFAULT_FALLBACK_MODEL = "gpt-5.4-mini";

type EnvLike = Record<string, string | undefined>;

interface ModelConfig {
  provider: string;
  model: string;
  apiKey: string | undefined;
  baseURL: string | undefined;
  source: "primary" | "fallback" | "memory";
}

function fallbackApiKey(provider: string, env: EnvLike) {
  if (provider === "codex") return undefined;
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

function defaultModelForProvider(provider: string) {
  if (provider === DEFAULT_PROVIDER) return DEFAULT_MODEL;
  if (provider === DEFAULT_FALLBACK_PROVIDER) return DEFAULT_FALLBACK_MODEL;
  if (provider === "codex") return "gpt-5.4";
  if (provider === "anthropic") return "claude-opus-4-7";
  if (provider === "openrouter") return "anthropic/claude-opus-4-7";
  return "";
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

function hasUsableCredentials(cfg: ModelConfig) {
  if (cfg.provider === "codex") {
    return !!readCodexCredentialsSync();
  }
  return !!cfg.apiKey;
}

function enabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export function getSupervisorModelConfig(env: EnvLike, source?: "primary" | "fallback" | "memory") {
  const primaryProvider = env.SUPERVISOR_LLM_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const fallbackProvider = env.SUPERVISOR_FALLBACK_LLM_PROVIDER?.trim() || DEFAULT_FALLBACK_PROVIDER;

  const primaryConfig: ModelConfig = {
    provider: primaryProvider,
    model: env.SUPERVISOR_LLM_MODEL?.trim() || (primaryProvider === "codex" ? "gpt-5.4" : DEFAULT_MODEL),
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

  if (source === "primary") {
    return primaryConfig;
  }
  if (source === "fallback") {
    return fallbackConfig;
  }

  if (source === "memory") {
    const supervisorConfig = hasUsableCredentials(primaryConfig) ? primaryConfig : hasUsableCredentials(fallbackConfig) ? fallbackConfig : primaryConfig;
    if (!enabled(env.SUPERVISOR_MEMORY_LLM_USE_CUSTOM)) {
      return supervisorConfig;
    }

    const memoryProvider = env.SUPERVISOR_MEMORY_LLM_PROVIDER?.trim() || supervisorConfig.provider;
    return {
      provider: memoryProvider,
      model: env.SUPERVISOR_MEMORY_LLM_MODEL?.trim()
        || (memoryProvider === supervisorConfig.provider ? supervisorConfig.model : defaultModelForProvider(memoryProvider)),
      apiKey: env.SUPERVISOR_MEMORY_LLM_API_KEY?.trim() || fallbackApiKey(memoryProvider, env),
      baseURL: env.SUPERVISOR_MEMORY_LLM_BASE_URL?.trim() || undefined,
      source: "memory",
    };
  }

  return hasUsableCredentials(primaryConfig) ? primaryConfig : hasUsableCredentials(fallbackConfig) ? fallbackConfig : primaryConfig;
}

export function validateSupervisorModelConfig(
  config: ReturnType<typeof getSupervisorModelConfig>,
  decryptionFailures: RuntimeSettingDecryptionFailure[],
) {
  if (config.provider === "codex") {
    const creds = readCodexCredentialsSync();
    if (!creds) {
      throw new CodexAuthMissingError();
    }
    return config;
  }

  if (config.apiKey) {
    return config;
  }

  const relevantSettings =
    config.source === "fallback"
      ? ["SUPERVISOR_FALLBACK_LLM_API_KEY"]
      : config.source === "memory"
        ? ["SUPERVISOR_MEMORY_LLM_API_KEY"]
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
  if (config.provider === "codex") {
    const provider = createOpenAI({
      baseURL: "https://chatgpt.com/backend-api/codex",
      fetch: async (url, options) => {
        const creds = await ensureFreshCodexCredentials();
        const headers = new Headers(options?.headers);
        headers.set("Authorization", `Bearer ${creds.accessToken}`);
        headers.set("chatgpt-account-id", creds.accountId);
        headers.set("OpenAI-Beta", "responses=experimental");

        return fetch(url, {
          ...options,
          headers,
        });
      },
    });

    return provider.responses(config.model);
  }

  const id = `${toMastraProvider(config.provider)}/${config.model}` as `${string}/${string}`;

  return {
    id,
    apiKey: config.apiKey,
    url: config.baseURL,
  };
}
