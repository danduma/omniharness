import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";

describe("settings crypto", () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    delete process.env.OMNIHARNESS_SETTINGS_KEY;
    delete process.env.OMNIHARNESS_SETTINGS_KEY_PATH;

    for (const entry of createdPaths.splice(0)) {
      if (fs.existsSync(entry)) {
        fs.rmSync(entry, { recursive: true, force: true });
      }
    }
  });

  it("encrypts plaintext into a reversible ciphertext envelope", () => {
    process.env.OMNIHARNESS_SETTINGS_KEY = Buffer.alloc(32, 7).toString("base64");

    const encrypted = encryptSettingValue("super-secret");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("super-secret");
    expect(decryptSettingValue(encrypted)).toBe("super-secret");
  });

  it("passes through legacy plaintext values unchanged when decrypting", () => {
    process.env.OMNIHARNESS_SETTINGS_KEY = Buffer.alloc(32, 9).toString("base64");

    expect(decryptSettingValue("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("creates and reuses a local key file when no env key is provided", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-settings-"));
    createdPaths.push(tempDir);
    process.env.OMNIHARNESS_SETTINGS_KEY_PATH = path.join(tempDir, "settings.key");

    const first = encryptSettingValue("hello");
    const second = encryptSettingValue("world");

    expect(fs.existsSync(process.env.OMNIHARNESS_SETTINGS_KEY_PATH)).toBe(true);
    expect(decryptSettingValue(first)).toBe("hello");
    expect(decryptSettingValue(second)).toBe("world");
  });
});
