import { describe, expect, it, vi } from "vitest";
import { configureSupervisorModel, getSupervisorModelConfig, validateSupervisorModelConfig } from "@/server/supervisor/model-config";

describe("supervisor model config", () => {
  it("defaults to Gemini with the requested preview model", () => {
    const config = getSupervisorModelConfig({});

    expect(config).toEqual({
      provider: "gemini",
      model: "gemini-3.1-pro-preview",
      apiKey: undefined,
      baseURL: undefined,
      source: "primary",
    });
  });

  it("honors explicit provider and model overrides from env", () => {
    const config = getSupervisorModelConfig({
      SUPERVISOR_LLM_PROVIDER: "anthropic",
      SUPERVISOR_LLM_MODEL: "claude-3-7-sonnet-latest",
      SUPERVISOR_LLM_API_KEY: "supervisor-key",
      SUPERVISOR_LLM_BASE_URL: "https://llm.example.com/v1",
    });

    expect(config).toEqual({
      provider: "anthropic",
      model: "claude-3-7-sonnet-latest",
      apiKey: "supervisor-key",
      baseURL: "https://llm.example.com/v1",
      source: "primary",
    });
  });

  it("falls back to the provider-specific API key when the generic one is absent", () => {
    const config = getSupervisorModelConfig({
      GEMINI_API_KEY: "gemini-key",
    });

    expect(config).toEqual({
      provider: "gemini",
      model: "gemini-3.1-pro-preview",
      apiKey: "gemini-key",
      baseURL: undefined,
      source: "primary",
    });
  });

  it("falls back to the dedicated fallback profile when the primary profile has no usable key", () => {
    const config = getSupervisorModelConfig({
      SUPERVISOR_LLM_PROVIDER: "anthropic",
      SUPERVISOR_LLM_MODEL: "claude-3-7-sonnet-latest",
      SUPERVISOR_FALLBACK_LLM_PROVIDER: "openai",
      SUPERVISOR_FALLBACK_LLM_MODEL: "gpt-5.4-mini",
      SUPERVISOR_FALLBACK_LLM_API_KEY: "fallback-key",
      SUPERVISOR_FALLBACK_LLM_BASE_URL: "https://fallback.example.com/v1",
    });

    expect(config).toEqual({
      provider: "openai",
      model: "gpt-5.4-mini",
      apiKey: "fallback-key",
      baseURL: "https://fallback.example.com/v1",
      source: "fallback",
    });
  });

  it("fails with a clear recovery message when the supervisor key cannot be decrypted", () => {
    const config = getSupervisorModelConfig({});

    expect(() => validateSupervisorModelConfig(config, [{ key: "SUPERVISOR_LLM_API_KEY" }])).toThrow(
      /SUPERVISOR_LLM_API_KEY".*could not be decrypted.*settings key/i,
    );
  });

  it("fails with a clear setup message when no usable API key is configured", () => {
    const config = getSupervisorModelConfig({
      SUPERVISOR_LLM_PROVIDER: "openai",
      SUPERVISOR_LLM_MODEL: "gpt-5.4",
    });

    expect(() => validateSupervisorModelConfig(config, [])).toThrow(
      /has no API key configured.*SUPERVISOR_LLM_API_KEY.*SUPERVISOR_FALLBACK_LLM_API_KEY.*OPENAI_API_KEY/i,
    );
  });

  it("allows provider fallback keys even if the dedicated supervisor key is broken", () => {
    const config = getSupervisorModelConfig({
      GEMINI_API_KEY: "gemini-key",
    });

    expect(() => validateSupervisorModelConfig(config, [{ key: "SUPERVISOR_LLM_API_KEY" }])).not.toThrow();
  });

  it("allows the fallback profile even if the primary secret cannot be decrypted", () => {
    const config = getSupervisorModelConfig({
      SUPERVISOR_FALLBACK_LLM_PROVIDER: "openai",
      SUPERVISOR_FALLBACK_LLM_MODEL: "gpt-5.4-mini",
      SUPERVISOR_FALLBACK_LLM_API_KEY: "fallback-key",
    });

    expect(() => validateSupervisorModelConfig(config, [{ key: "SUPERVISOR_LLM_API_KEY" }])).not.toThrow();
  });

  it("registers unsupported Gemini preview models with TokenJS", () => {
    const extendModelList = vi.fn();

    configureSupervisorModel(
      {
        SUPERVISOR_LLM_PROVIDER: "gemini",
        SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
      },
      { extendModelList } as { extendModelList: typeof extendModelList },
    );

    expect(extendModelList).toHaveBeenCalledWith("gemini", "gemini-3.1-pro-preview", {
      streaming: true,
      json: true,
      toolCalls: true,
      images: true,
    });
  });

  it("does not extend non-Gemini models", () => {
    const extendModelList = vi.fn();

    configureSupervisorModel(
      {
        SUPERVISOR_LLM_PROVIDER: "anthropic",
        SUPERVISOR_LLM_MODEL: "claude-3-7-sonnet-latest",
      },
      { extendModelList } as { extendModelList: typeof extendModelList },
    );

    expect(extendModelList).not.toHaveBeenCalled();
  });
});
