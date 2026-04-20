import type { TokenJS } from "token.js";

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.1-pro-preview";

type EnvLike = Record<string, string | undefined>;

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

export function getSupervisorModelConfig(env: EnvLike) {
  const provider = env.SUPERVISOR_LLM_PROVIDER?.trim() || DEFAULT_PROVIDER;

  return {
    provider,
    model: env.SUPERVISOR_LLM_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: env.SUPERVISOR_LLM_API_KEY?.trim() || fallbackApiKey(provider, env),
    baseURL: env.SUPERVISOR_LLM_BASE_URL?.trim() || undefined,
  };
}

export function configureSupervisorModel(env: EnvLike, tokenjs: Pick<TokenJS, "extendModelList">) {
  const config = getSupervisorModelConfig(env);

  if (config.provider === "gemini") {
    tokenjs.extendModelList("gemini", config.model, {
      streaming: true,
      json: true,
      toolCalls: true,
      images: true,
    });
  }

  return config;
}
