import { describe, expect, it, vi } from "vitest";
import { configureSupervisorModel, getSupervisorModelConfig } from "@/server/supervisor/model-config";

describe("supervisor model config", () => {
  it("defaults to Gemini with the requested preview model", () => {
    const config = getSupervisorModelConfig({});

    expect(config).toEqual({
      provider: "gemini",
      model: "gemini-3.1-pro-preview",
      apiKey: undefined,
      baseURL: undefined,
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
    });
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
