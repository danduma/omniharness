import os from "node:os";

type EnvLike = Record<string, string | undefined>;

const EXACT_CLAUDE_ROUTING_KEYS = new Set([
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
  "CLAUDE_CODE_ACCOUNT_UUID",
  "CLAUDE_CODE_USER_EMAIL",
  "CLAUDE_CODE_ORGANIZATION_UUID",
]);

const AUTH_ENV_KEYS = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "SHELL",
  "TMPDIR", "TEMP", "TMP", "TERM", "LANG",
  "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
  "http_proxy", "https_proxy", "all_proxy", "no_proxy",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
]);

export type ClaudeAuthStatus = {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
  subscriptionType?: string;
};

export const CLAUDE_STATUS_ARGS = ["auth", "status", "--json"] as const;
export const CLAUDE_LOGOUT_ARGS = ["auth", "logout"] as const;

export function isClaudeCredentialRoutingKey(key: string) {
  const normalized = process.platform === "win32" ? key.toUpperCase() : key;
  return normalized.startsWith("ANTHROPIC_") || EXACT_CLAUDE_ROUTING_KEYS.has(normalized);
}

export function claudeCredentialRoutingKeys(env: EnvLike) {
  return Object.keys(env).filter(isClaudeCredentialRoutingKey);
}

export function stripClaudeCredentialRoutingEnv<T extends EnvLike>(source: T): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && !isClaudeCredentialRoutingKey(key)) {
      result[key] = value;
    }
  }
  return result;
}

export function buildClaudeAuthChildEnv(source: EnvLike, configDir: string) {
  const stripped = stripClaudeCredentialRoutingEnv(source);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(stripped)) {
    if (AUTH_ENV_KEYS.has(key) || key.startsWith("LC_")) {
      result[key] = value;
    }
  }
  result.PATH = result.PATH || process.env.PATH || "";
  result.HOME = result.HOME || os.homedir();
  result.TERM = result.TERM || "xterm-256color";
  result.LANG = "C";
  result.LC_ALL = "C";
  result.CLAUDE_CONFIG_DIR = configDir;
  return result;
}

export function buildClaudeLoginArgs(options: { email?: string | null; sso?: boolean }) {
  const args = ["auth", "login", "--claudeai"];
  const email = options.email?.trim();
  if (email) {
    args.push("--email", email);
  }
  if (options.sso) {
    args.push("--sso");
  }
  return args;
}

function optionalSafeString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseClaudeAuthStatus(raw: string): ClaudeAuthStatus {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Claude authentication status was not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Claude authentication status was not an object.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.loggedIn !== "boolean") {
    throw new Error("Claude authentication status is missing a boolean loggedIn field.");
  }
  const result: ClaudeAuthStatus = { loggedIn: record.loggedIn };
  for (const key of ["authMethod", "apiProvider", "email", "subscriptionType"] as const) {
    const value = optionalSafeString(record, key);
    if (value) result[key] = value;
  }
  return result;
}

export function claudeSafeIdentity(status: ClaudeAuthStatus, checkedAt = new Date()) {
  const { loggedIn: _loggedIn, ...identity } = status;
  return { ...identity, checkedAt: checkedAt.toISOString() };
}

export function assertClaudeLoginInput(input: { label: string; email?: string | null }) {
  const label = input.label.trim().replace(/\s+/g, " ");
  if (!label || label.length > 80 || /[\u0000-\u001f\u007f]/.test(label)) {
    throw new TypeError("Account label must be between 1 and 80 printable characters.");
  }
  const email = input.email?.trim() || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new TypeError("Email address is not valid.");
  }
  return { label, email };
}
