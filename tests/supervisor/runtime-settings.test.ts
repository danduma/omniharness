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
    const env = hydrateRuntimeEnvFromSettings([
      { key: "GEMINI_API_KEY", value: "enc:v1:secret-value" },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview" },
    ]);

    expect(env).toEqual({
      GEMINI_API_KEY: "decrypted:secret-value",
      SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
    });
  });

  it("drops undecryptable secret settings instead of passing ciphertext through", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const env = hydrateRuntimeEnvFromSettings([
      { key: "GEMINI_API_KEY", value: "enc:v1:broken" },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview" },
    ]);

    expect(env).toEqual({
      SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
