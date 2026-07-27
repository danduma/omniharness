import { describe, expect, it, vi } from "vitest";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";

vi.mock("@/server/settings/crypto", () => ({
  decryptSettingValue: (value: string) => {
    if (value === "enc:v1:broken") {
      throw new Error("Unable to decrypt stored setting value.");
    }
    return value.startsWith("enc:v1:")
      ? `decrypted:${value.slice("enc:v1:".length)}`
      : value;
  },
  shouldEncryptSetting: (key: string) => key.endsWith("_API_KEY"),
}));

describe("hydrateRuntimeEnvFromSettings", () => {
  it("decrypts stored secret settings before exposing them to runtime code", () => {
    const result = hydrateRuntimeEnvFromSettings([
      { key: "GEMINI_API_KEY", value: "enc:v1:secret-value" },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.5-flash" },
    ]);

    expect(result).toEqual({
      env: {
        GEMINI_API_KEY: "decrypted:secret-value",
        SUPERVISOR_LLM_MODEL: "gemini-3.5-flash",
      },
      decryptionFailures: [],
    });
  });

  it("tracks undecryptable secret settings instead of passing ciphertext through", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = hydrateRuntimeEnvFromSettings([
      { key: "GEMINI_API_KEY", value: "enc:v1:broken" },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.5-flash" },
    ]);

    expect(result).toEqual({
      env: {
        SUPERVISOR_LLM_MODEL: "gemini-3.5-flash",
      },
      decryptionFailures: [{ key: "GEMINI_API_KEY" }],
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not try to decrypt non-secret settings that happen to look encrypted", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = hydrateRuntimeEnvFromSettings([
      { key: "TEST_SUPERVISOR_MODEL", value: "enc:v1:invalid-payload" },
    ]);

    expect(result).toEqual({
      env: {
        TEST_SUPERVISOR_MODEL: "enc:v1:invalid-payload",
      },
      decryptionFailures: [],
    });
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not expose internal persisted settings as runtime environment variables", () => {
    const result = hydrateRuntimeEnvFromSettings([
      { key: "SUPERVISOR_WAKE_LEASE:run-1", value: "{\"leaseId\":\"lease-1\"}" },
      { key: "settings.runtime.recovery", value: "true" },
      { key: "OPENAI_API_KEY", value: "enc:v1:key" },
    ]);

    expect(result).toEqual({
      env: {
        OPENAI_API_KEY: "decrypted:key",
      },
      decryptionFailures: [],
    });
  });

  it("never exposes Claude gateway control settings to native or routed worker base environments", () => {
    const result = hydrateRuntimeEnvFromSettings([
      { key: "CLAUDE_MODEL_GATEWAY_MODE", value: "managed" },
      { key: "CLAUDE_MODEL_GATEWAY_ENABLED", value: "true" },
      { key: "CLAUDE_MODEL_GATEWAY_BASE_URL", value: "http://127.0.0.1:8317" },
      { key: "CLAUDE_MODEL_GATEWAY_API_TOKEN", value: "enc:v1:api-secret" },
      { key: "CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN", value: "enc:v1:management-secret" },
      { key: "CLAUDE_MODEL_GATEWAY_MODELS", value: "[]" },
      { key: "ANTHROPIC_API_KEY", value: "enc:v1:native-secret" },
    ]);

    expect(result.env).toEqual({ ANTHROPIC_API_KEY: "decrypted:native-secret" });
    expect(Object.keys(result.env)).not.toContain(expect.stringMatching(/^CLAUDE_MODEL_GATEWAY_/));
    expect(JSON.stringify(result)).not.toContain("api-secret");
    expect(JSON.stringify(result)).not.toContain("management-secret");
  });
});
