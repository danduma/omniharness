import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import lockfile from "proper-lockfile";

export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

export class CodexAuthMissingError extends Error {
  constructor() {
    super("Codex credentials missing. Run `codex login` in your terminal.");
    this.name = "CodexAuthMissingError";
  }
}

export class CodexAuthRefreshFailedError extends Error {
  constructor(message: string) {
    super(`Codex token refresh failed: ${message}`);
    this.name = "CodexAuthRefreshFailedError";
  }
}

export interface CodexCredentials {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  idToken: string;
  planType: string;
  email: string;
  expiresAt: number; // Unix timestamp in seconds
  subscriptionActiveUntil: string | null;
  lastRefresh: string | null;
}

export function getCodexAuthPath(): string {
  const home = process.env.CODEX_HOME || os.homedir();
  return path.join(home, ".codex", "auth.json");
}

function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function readCodexCredentialsSync(): CodexCredentials | null {
  const authPath = getCodexAuthPath();
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(authPath, "utf8");
    const data = JSON.parse(content);

    if (data.auth_mode !== "chatgpt" || !data.tokens) {
      return null;
    }

    const { tokens, last_refresh } = data;
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const accountId = tokens.account_id;
    const idToken = tokens.id_token;

    if (!accessToken || !refreshToken || !accountId) {
      return null;
    }

    const accessPayload = parseJwt(accessToken);
    const idPayload = parseJwt(idToken);

    if (!accessPayload) {
      return null;
    }

    // Extract info from tokens
    const email = accessPayload["https://api.openai.com/profile"]?.email || idPayload?.email || "";
    const planType = accessPayload["https://api.openai.com/auth"]?.chatgpt_plan_type || idPayload?.["https://api.openai.com/auth"]?.chatgpt_plan_type || "free";
    const expiresAt = accessPayload.exp;
    const subscriptionActiveUntil = idPayload?.["https://api.openai.com/auth"]?.chatgpt_subscription_active_until || null;

    return {
      accessToken,
      refreshToken,
      accountId,
      idToken,
      planType,
      email,
      expiresAt,
      subscriptionActiveUntil,
      lastRefresh: last_refresh || null,
    };
  } catch (e) {
    return null;
  }
}

export async function readCodexCredentials(): Promise<CodexCredentials | null> {
  return readCodexCredentialsSync();
}

export function isCodexCredentialsExpired(creds: CodexCredentials, skewSeconds = 60): boolean {
  const now = Math.floor(Date.now() / 1000);
  return creds.expiresAt < now + skewSeconds;
}

export async function refreshCodexCredentialsDirectly(creds: CodexCredentials): Promise<CodexCredentials> {
  const response = await fetch("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: CODEX_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CodexAuthRefreshFailedError(`Server returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const nextAccessToken = data.access_token;
  const nextRefreshToken = data.refresh_token;
  const nextIdToken = data.id_token;

  if (!nextAccessToken || !nextRefreshToken) {
    throw new CodexAuthRefreshFailedError("Incomplete response from auth server");
  }

  const authPath = getCodexAuthPath();
  let release: (() => Promise<void>) | null = null;
  try {
    // Ensure the directory exists if we're in a test environment with a temp CODEX_HOME
    const dir = path.dirname(authPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Lock the file for writing
    if (fs.existsSync(authPath)) {
      release = await lockfile.lock(authPath, { retries: 5 });
    }

    const content = fs.existsSync(authPath) ? fs.readFileSync(authPath, "utf8") : "{}";
    const authJson = JSON.parse(content);

    authJson.tokens = {
      ...authJson.tokens,
      access_token: nextAccessToken,
      refresh_token: nextRefreshToken,
      id_token: nextIdToken || authJson.tokens?.id_token,
    };
    authJson.last_refresh = new Date().toISOString();

    fs.writeFileSync(authPath, JSON.stringify(authJson, null, 2), { mode: 0o600 });

    const nextCreds = readCodexCredentialsSync();
    if (!nextCreds) {
      throw new CodexAuthRefreshFailedError("Failed to parse credentials after refresh");
    }
    return nextCreds;
  } finally {
    if (release) {
      await release();
    }
  }
}

export async function ensureFreshCodexCredentials(): Promise<CodexCredentials> {
  const creds = readCodexCredentialsSync();
  if (!creds) {
    throw new CodexAuthMissingError();
  }

  if (!isCodexCredentialsExpired(creds)) {
    return creds;
  }

  try {
    return await refreshCodexCredentialsDirectly(creds);
  } catch (e) {
    if (e instanceof CodexAuthRefreshFailedError) {
      throw e;
    }
    throw new CodexAuthRefreshFailedError(e instanceof Error ? e.message : String(e));
  }
}
