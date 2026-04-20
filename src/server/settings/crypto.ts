import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const ENVELOPE_PREFIX = "enc:v1:";
const KEY_BYTES = 32;
const IV_BYTES = 12;

function resolveKeyPath() {
  if (process.env.OMNIHARNESS_SETTINGS_KEY_PATH?.trim()) {
    return process.env.OMNIHARNESS_SETTINGS_KEY_PATH.trim();
  }

  return path.join(os.homedir(), ".omniharness", "settings.key");
}

function readOrCreateKey() {
  if (process.env.OMNIHARNESS_SETTINGS_KEY?.trim()) {
    return Buffer.from(process.env.OMNIHARNESS_SETTINGS_KEY.trim(), "base64");
  }

  const keyPath = resolveKeyPath();
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, crypto.randomBytes(KEY_BYTES).toString("base64"), { mode: 0o600 });
  }

  return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
}

function getKey() {
  const key = readOrCreateKey();
  if (key.length !== KEY_BYTES) {
    throw new Error("Settings encryption key must be 32 bytes (base64 encoded).");
  }
  return key;
}

export function encryptSettingValue(plaintext: string) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENVELOPE_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptSettingValue(storedValue: string) {
  if (!storedValue.startsWith(ENVELOPE_PREFIX)) {
    return storedValue;
  }

  const payload = Buffer.from(storedValue.slice(ENVELOPE_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + 16);
  const ciphertext = payload.subarray(IV_BYTES + 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
