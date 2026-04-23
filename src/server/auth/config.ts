import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getAppDataPath } from "@/server/app-root";

export const AUTH_SESSION_COOKIE = "omni_session";
export const AUTH_SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 30;
export const AUTH_SESSION_ABSOLUTE_MS = 1000 * 60 * 60 * 24 * 90;
export const AUTH_PAIR_TOKEN_TTL_MS = 1000 * 60 * 2;

function resolveAuthKeyPath() {
  if (process.env.OMNIHARNESS_AUTH_KEY_PATH?.trim()) {
    return path.resolve(process.env.OMNIHARNESS_AUTH_KEY_PATH.trim());
  }

  return getAppDataPath(".omniharness-auth.key");
}

function readOrCreateAuthKey() {
  if (process.env.OMNIHARNESS_AUTH_KEY?.trim()) {
    return Buffer.from(process.env.OMNIHARNESS_AUTH_KEY.trim(), "base64");
  }

  const keyPath = resolveAuthKeyPath();
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  }

  return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
}

export function getAuthKey() {
  const key = readOrCreateAuthKey();
  if (key.length !== 32) {
    throw new Error("Auth key must be 32 bytes (base64 encoded).");
  }
  return key;
}

export function getConfiguredAuthPasswordHash() {
  return process.env.OMNIHARNESS_AUTH_PASSWORD_HASH?.trim() || null;
}

export function getConfiguredAuthPassword() {
  return process.env.OMNIHARNESS_AUTH_PASSWORD?.trim() || null;
}

export function isAuthEnabled() {
  return Boolean(getConfiguredAuthPasswordHash() || getConfiguredAuthPassword());
}

export function getPublicOriginFromUrl(url: string) {
  const configured = process.env.OMNIHARNESS_PUBLIC_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(url).origin;
}
