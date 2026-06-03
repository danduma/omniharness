import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getAppDataPath } from "@/server/app-root";

export const AUTH_SESSION_COOKIE = "omni_session";
export const AUTH_SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 30;
export const AUTH_SESSION_ABSOLUTE_MS = 1000 * 60 * 60 * 24 * 90;

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
  return normalizeEnvValue(process.env.OMNIHARNESS_AUTH_PASSWORD_HASH);
}

export function getConfiguredAuthPassword() {
  return normalizeEnvValue(process.env.OMNIHARNESS_AUTH_PASSWORD);
}

function normalizeEnvValue(value: string | undefined) {
  let normalized = value?.trim() || "";
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\""))
    || (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/\\\$/g, "$");
  return normalized || null;
}

function isArgon2PasswordHash(value: string) {
  const fields = value.split("$");
  return fields.length === 6
    && fields[0] === ""
    && ["argon2d", "argon2i", "argon2id"].includes(fields[1] ?? "")
    && fields.every((field, index) => index === 0 || field.length > 0);
}

export function isAuthConfigured() {
  return Boolean(getConfiguredAuthPasswordHash() || getConfiguredAuthPassword());
}

export function isDevelopmentMode() {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

export function isAuthRequired() {
  return true;
}

export function isAuthEnabled() {
  return isAuthRequired() || isAuthConfigured();
}

export function isAutomationAuthBypassEnabled() {
  return process.env.OMNIHARNESS_TEST_BYPASS_AUTH === "true"
    && (process.env.NODE_ENV === "test" || process.env.OMNIHARNESS_E2E_BYPASS_AUTH === "true");
}

export function getAuthConfigurationError() {
  if (!isAuthRequired()) {
    return null;
  }

  const configuredHash = getConfiguredAuthPasswordHash();
  if (configuredHash && !isArgon2PasswordHash(configuredHash)) {
    return "OMNIHARNESS_AUTH_PASSWORD_HASH is not a valid Argon2 password hash. Regenerate it with scripts/setup-auth.mjs or escape dollar signs in .env files as \\$ so dotenv does not expand them.";
  }

  if (!isAuthConfigured()) {
    return "Authentication is required. Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH before starting OmniHarness.";
  }

  return null;
}

export function getPublicOriginFromUrl(url: string) {
  const configured = process.env.OMNIHARNESS_PUBLIC_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(url).origin;
}

export function getPublicOriginFromRequest(url: string, headers: Headers) {
  const configured = process.env.OMNIHARNESS_PUBLIC_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const requestUrl = new URL(url);
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = forwardedHost || headers.get("host")?.trim();
  if (!host) {
    return requestUrl.origin;
  }

  const protocol = firstHeaderValue(headers.get("x-forwarded-proto")) || requestUrl.protocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}
