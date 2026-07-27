import { z } from "zod";

export const CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX = "cliproxyapi:";
export const CLAUDE_MODEL_GATEWAY_SETTING_KEYS = {
  mode: "CLAUDE_MODEL_GATEWAY_MODE",
  enabled: "CLAUDE_MODEL_GATEWAY_ENABLED",
  baseUrl: "CLAUDE_MODEL_GATEWAY_BASE_URL",
  apiToken: "CLAUDE_MODEL_GATEWAY_API_TOKEN",
  managementToken: "CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN",
  models: "CLAUDE_MODEL_GATEWAY_MODELS",
  catalogCache: "__CLAUDE_MODEL_GATEWAY_CATALOG_CACHE",
} as const;

export const DEFAULT_CLAUDE_GATEWAY_MODELS = [
  { id: "gpt-5.6-sol", label: "GPT-5.6 SOL" },
] as const;

export const CLAUDE_GATEWAY_REQUIRED_ENV = {
  CLAUDE_CODE_ALWAYS_ENABLE_EFFORT: "1",
  CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "3",
  ENABLE_TOOL_SEARCH: "false",
} as const;

export function validateClaudeGatewayRuntimeRequest(input: {
  type: string;
  model?: string | null;
  accountId?: string | null;
  credentialSource?: string | null;
  env?: Record<string, string>;
}) {
  if (input.credentialSource !== "gateway") return null;
  const model = input.model?.trim() ?? "";
  const env = input.env ?? {};
  if (input.type.trim().toLowerCase() !== "claude") throw new Error("Gateway credentials require a Claude worker.");
  if (input.accountId != null && input.accountId.trim() !== "") throw new Error("Gateway credentials cannot be combined with an account.");
  if (!model) throw new Error("Gateway credentials require a model.");
  if (!env.ANTHROPIC_BASE_URL?.trim() || !env.ANTHROPIC_AUTH_TOKEN?.trim()) throw new Error("Gateway endpoint and token are required.");
  if (env.ANTHROPIC_MODEL !== model || env.CLAUDE_CODE_SUBAGENT_MODEL !== model) throw new Error("Gateway model environment does not match the requested model.");
  for (const [key, expected] of Object.entries(CLAUDE_GATEWAY_REQUIRED_ENV)) {
    if (env[key] !== expected) throw new Error(`Gateway environment ${key} is invalid.`);
  }
  const allowedKeys = new Set([
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL",
    ...Object.keys(CLAUDE_GATEWAY_REQUIRED_ENV),
    "ANTHROPIC_CUSTOM_MODEL_OPTION",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
  ]);
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowedKeys.has(key)));
}

const MODEL_ID_MAX_LENGTH = 256;
const MODEL_LABEL_MAX_LENGTH = 120;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export type ClaudeGatewayModelInput = {
  id: string;
  label?: string;
};

export type ClaudeGatewayCatalogModel = {
  rawId: string;
  value: string;
  label: string;
  source: "custom" | "discovered";
};

export type ClaudeModelGatewayMode = "managed" | "external";
export type ClaudeModelGatewayInstallationState = "absent" | "installing" | "installed" | "unsupported" | "error";
export type ClaudeModelGatewayServiceState = "stopped" | "starting" | "running" | "unreachable" | "error";
export type ClaudeModelGatewayOAuthState = "disconnected" | "connecting" | "connected" | "error";
export type ClaudeModelGatewayAction = "install" | "start" | "stop" | "connect" | "refresh_models";

export type ClaudeModelGatewayOperation = {
  id: string;
  kind: ClaudeModelGatewayAction;
  state: "running" | "completed" | "failed";
  error?: {
    code: string;
    message: string;
    cause?: { name: string; message: string } | null;
  } | null;
};

export type ClaudeModelGatewayStatus = {
  revision: number;
  mode: ClaudeModelGatewayMode;
  enabled: boolean;
  installation: ClaudeModelGatewayInstallationState;
  service: ClaudeModelGatewayServiceState;
  oauth: ClaudeModelGatewayOAuthState;
  connection: {
    baseUrl: string;
    apiTokenConfigured: boolean;
    managementTokenConfigured: boolean;
  };
  installedVersion: string | null;
  installedSource: "managed" | "system" | null;
  operation: ClaudeModelGatewayOperation | null;
  models: {
    custom: ClaudeGatewayModelInput[];
    discovered: ClaudeGatewayModelInput[];
    updatedAt: string | null;
    stale: boolean;
  };
};

export function normalizeClaudeGatewayBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Claude model gateway URL must be a valid HTTP or HTTPS URL.");
  }
  if (!(new Set(["http:", "https:"])).has(url.protocol)) {
    throw new Error("Claude model gateway URL must use HTTP or HTTPS.");
  }
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (url.protocol === "http:" && !loopbackHosts.has(url.hostname.toLowerCase())) {
    throw new Error("Remote Claude model gateway URLs must use HTTPS.");
  }
  if (url.username || url.password) throw new Error("Claude model gateway URL cannot contain credentials.");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function normalizedRequiredText(value: string, field: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new Error(`${field} cannot contain control characters.`);
  }
  return normalized;
}

export function validateClaudeGatewayModel(input: ClaudeGatewayModelInput): ClaudeGatewayModelInput {
  const id = normalizedRequiredText(input.id, "Model id", MODEL_ID_MAX_LENGTH);
  if (id.startsWith(CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX)) {
    throw new Error("Model id must be the raw gateway id, without the OmniHarness route prefix.");
  }
  const label = input.label == null || input.label.trim() === ""
    ? undefined
    : normalizedRequiredText(input.label, "Model label", MODEL_LABEL_MAX_LENGTH);
  return { id, ...(label ? { label } : {}) };
}

export function encodeClaudeGatewayModel(rawId: string) {
  return `${CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX}${validateClaudeGatewayModel({ id: rawId }).id}`;
}

export function decodeClaudeGatewayModel(selection: string | null | undefined) {
  const normalized = selection?.trim() ?? "";
  if (!normalized.startsWith(CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX)) {
    return null;
  }
  const rawId = normalized.slice(CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX.length);
  try {
    return validateClaudeGatewayModel({ id: rawId }).id;
  } catch {
    return null;
  }
}

export function mergeClaudeGatewayModels(input: {
  custom?: ClaudeGatewayModelInput[];
  discovered?: ClaudeGatewayModelInput[];
}): ClaudeGatewayCatalogModel[] {
  const merged = new Map<string, ClaudeGatewayCatalogModel>();
  const add = (model: ClaudeGatewayModelInput, source: ClaudeGatewayCatalogModel["source"]) => {
    const validated = validateClaudeGatewayModel(model);
    if (merged.has(validated.id)) return;
    merged.set(validated.id, {
      rawId: validated.id,
      value: encodeClaudeGatewayModel(validated.id),
      label: validated.label ?? validated.id,
      source,
    });
  };

  for (const model of input.custom ?? []) add(model, "custom");
  for (const model of input.discovered ?? []) add(model, "discovered");
  return [...merged.values()];
}

const gatewayModelSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
}).transform((model) => validateClaudeGatewayModel(model));

const publicErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  cause: z.object({ name: z.string(), message: z.string() }).nullable().optional(),
});

const gatewayStatusSchema = z.object({
  revision: z.number().int().nonnegative(),
  mode: z.enum(["managed", "external"]),
  enabled: z.boolean(),
  installation: z.enum(["absent", "installing", "installed", "unsupported", "error"]),
  service: z.enum(["stopped", "starting", "running", "unreachable", "error"]),
  oauth: z.enum(["disconnected", "connecting", "connected", "error"]),
  connection: z.object({
    baseUrl: z.string().url(),
    apiTokenConfigured: z.boolean(),
    managementTokenConfigured: z.boolean(),
  }),
  installedVersion: z.string().nullable(),
  installedSource: z.enum(["managed", "system"]).nullable(),
  operation: z.object({
    id: z.string(),
    kind: z.enum(["install", "start", "stop", "connect", "refresh_models"]),
    state: z.enum(["running", "completed", "failed"]),
    error: publicErrorSchema.nullable().optional(),
  }).nullable(),
  models: z.object({
    custom: z.array(gatewayModelSchema),
    discovered: z.array(gatewayModelSchema),
    updatedAt: z.string().datetime().nullable(),
    stale: z.boolean(),
  }),
});

export function parseClaudeModelGatewayStatus(value: unknown): ClaudeModelGatewayStatus {
  return gatewayStatusSchema.parse(value);
}
