import {
  createHash,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isLoopbackAddress } from "@/server/auth/trusted-proxy";

const BASE64URL_VALUE = /^[A-Za-z0-9_-]{43,128}$/;
const AUTHORIZATION_CODE_TTL_MS = 60_000;

export type BrowserAuthorizationRequest = {
  origin: string;
  state: string;
  challenge: string;
  method: "S256";
};

type AuthorizationCodeRecord = BrowserAuthorizationRequest & {
  expiresAt: number;
};

function assertBase64Url(value: string, label: string) {
  if (!BASE64URL_VALUE.test(value)) {
    throw new TypeError(`${label} must be 43–128 base64url characters.`);
  }
}

export function validateBrowserAuthorizationOrigin(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("Authorization origin must be an exact URL origin.");
  }
  if (parsed.origin !== value || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new TypeError("Authorization origin must be an exact origin without a path.");
  }
  const secure = parsed.protocol === "https:";
  const loopbackDevelopment = parsed.protocol === "http:"
    && isLoopbackAddress(parsed.hostname);
  if (!secure && !loopbackDevelopment) {
    throw new TypeError("Authorization origin must use HTTPS or loopback HTTP.");
  }
  return parsed.origin;
}

export function validateBrowserAuthorizationRequest(
  input: Record<string, unknown>,
): BrowserAuthorizationRequest {
  const origin = typeof input.origin === "string"
    ? validateBrowserAuthorizationOrigin(input.origin)
    : "";
  const state = typeof input.state === "string" ? input.state : "";
  const challenge = typeof input.challenge === "string" ? input.challenge : "";
  if (input.method !== "S256") {
    throw new TypeError("Browser authorization requires S256.");
  }
  assertBase64Url(state, "Authorization state");
  assertBase64Url(challenge, "PKCE challenge");
  return { origin, state, challenge, method: "S256" };
}

export function createS256Challenge(verifier: string) {
  assertBase64Url(verifier, "PKCE verifier");
  return createHash("sha256").update(verifier).digest("base64url");
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("base64url");
}

export class BrowserAuthorizationCodeManager {
  private readonly records = new Map<string, AuthorizationCodeRecord>();
  private readonly now: () => number;
  private readonly randomBytes: () => Buffer;

  constructor(options: {
    now?: () => number;
    randomBytes?: () => Buffer;
  } = {}) {
    this.now = options.now ?? Date.now;
    this.randomBytes = options.randomBytes ?? (() => nodeRandomBytes(32));
  }

  approve(input: BrowserAuthorizationRequest) {
    const request = validateBrowserAuthorizationRequest(input);
    const code = this.randomBytes().toString("base64url");
    assertBase64Url(code, "Authorization code");
    this.records.set(hashCode(code), {
      ...request,
      expiresAt: this.now() + AUTHORIZATION_CODE_TTL_MS,
    });
    return {
      code,
      state: request.state,
      origin: request.origin,
      expiresAt: new Date(this.now() + AUTHORIZATION_CODE_TTL_MS).toISOString(),
    };
  }

  consume(input: {
    code: string;
    verifier: string;
    state: string;
    origin: string;
  }) {
    assertBase64Url(input.code, "Authorization code");
    assertBase64Url(input.verifier, "PKCE verifier");
    assertBase64Url(input.state, "Authorization state");
    const origin = validateBrowserAuthorizationOrigin(input.origin);
    const key = hashCode(input.code);
    const record = this.records.get(key);
    this.records.delete(key);
    if (!record) {
      throw new Error("Authorization code is invalid or already used.");
    }
    if (record.expiresAt <= this.now()) {
      throw new Error("Authorization code expired.");
    }
    if (record.origin !== origin) {
      throw new Error("Authorization code origin does not match.");
    }
    if (record.state !== input.state) {
      throw new Error("Authorization code state does not match.");
    }
    const actualChallenge = createS256Challenge(input.verifier);
    const expected = Buffer.from(record.challenge);
    const actual = Buffer.from(actualChallenge);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error("PKCE verifier does not match.");
    }
    return { origin: record.origin, state: record.state };
  }

  hasPendingOrigin(origin: string) {
    const now = this.now();
    for (const [key, record] of this.records) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
        continue;
      }
      if (record.origin === origin) {
        return true;
      }
    }
    return false;
  }

  reset() {
    this.records.clear();
  }
}

export const browserAuthorizationCodeManager = new BrowserAuthorizationCodeManager();
