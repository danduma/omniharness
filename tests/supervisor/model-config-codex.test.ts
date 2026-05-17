import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSupervisorModelConfig, validateSupervisorModelConfig, buildMastraModelConfig } from "../../src/server/supervisor/model-config";
import * as codexAuth from "../../src/server/supervisor/codex-auth";

vi.mock("../../src/server/supervisor/codex-auth");

describe("model-config-codex", () => {
  beforeEach(() => {
    vi.mocked(codexAuth.readCodexCredentialsSync).mockReset();
    vi.mocked(codexAuth.ensureFreshCodexCredentials).mockReset();
  });

  describe("getSupervisorModelConfig", () => {
    it("picks codex provider when SUPERVISOR_LLM_PROVIDER=codex and credentials exist", () => {
      vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue({} as any);
      
      const env = { SUPERVISOR_LLM_PROVIDER: "codex" };
      const config = getSupervisorModelConfig(env);
      
      expect(config.provider).toBe("codex");
      expect(config.model).toBe("gpt-5.4");
    });

    it("falls back to secondary if codex credentials are missing", () => {
      vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue(null);
      
      const env = { 
        SUPERVISOR_LLM_PROVIDER: "codex",
        SUPERVISOR_FALLBACK_LLM_PROVIDER: "openai",
        SUPERVISOR_FALLBACK_LLM_API_KEY: "sk-mock"
      };
      const config = getSupervisorModelConfig(env);
      
      expect(config.provider).toBe("openai");
      expect(config.source).toBe("fallback");
    });
  });

  describe("validateSupervisorModelConfig", () => {
    it("throws CodexAuthMissingError if creds missing for codex provider", () => {
      vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue(null);
      
      const config = { provider: "codex", model: "gpt-5.4", source: "primary" } as any;
      expect(() => validateSupervisorModelConfig(config, [])).toThrow(codexAuth.CodexAuthMissingError);
    });

    it("passes validation if creds exist for codex", () => {
      vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue({} as any);
      
      const config = { provider: "codex", model: "gpt-5.4", source: "primary" } as any;
      expect(validateSupervisorModelConfig(config, [])).toBe(config);
    });
  });

  describe("buildMastraModelConfig", () => {
    it("builds a custom provider for codex", async () => {
      const config = { provider: "codex", model: "gpt-5.4" } as any;
      const model = buildMastraModelConfig(config);
      
      expect(model).toBeDefined();
      expect(model.modelId).toBe("gpt-5.4");
    });
  });
});
