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
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview" },
    ]);

    expect(result).toEqual({
      env: {
        GEMINI_API_KEY: "decrypted:secret-value",
        SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
      },
      decryptionFailures: [],
    });
  });

  it("tracks undecryptable secret settings instead of passing ciphertext through", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = hydrateRuntimeEnvFromSettings([
      { key: "GEMINI_API_KEY", value: "enc:v1:broken" },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview" },
    ]);

    expect(result).toEqual({
      env: {
        SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
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
});
