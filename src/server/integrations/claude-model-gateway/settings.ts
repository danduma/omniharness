import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  CLAUDE_MODEL_GATEWAY_SETTING_KEYS,
  DEFAULT_CLAUDE_GATEWAY_MODELS,
  validateClaudeGatewayModel,
  normalizeClaudeGatewayBaseUrl,
  type ClaudeGatewayModelInput,
  type ClaudeModelGatewayMode,
} from "@/lib/claude-model-gateway";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";

export type ClaudeModelGatewayCatalogCache = {
  models: ClaudeGatewayModelInput[];
  updatedAt: string | null;
};

export type ClaudeModelGatewaySettings = {
  mode: ClaudeModelGatewayMode;
  enabled: boolean;
  baseUrl: string;
  apiToken: string;
  managementToken: string;
  customModels: ClaudeGatewayModelInput[];
  catalog: ClaudeModelGatewayCatalogCache;
};

export function readClaudeGatewayModelsFromSettingRows(rows: Array<{ key: string; value: string }>) {
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    custom: parseModels(
      values.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.models),
      "models",
      DEFAULT_CLAUDE_GATEWAY_MODELS.map((model) => ({ ...model })),
    ),
    discovered: parseCatalog(values.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.catalogCache)).models,
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseModels(value: string | undefined, field: string, fallback: ClaudeGatewayModelInput[]) {
  if (!value?.trim()) return fallback.map((model) => ({ ...model }));
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected an array");
    const models = parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("expected model objects");
      const model = entry as { id?: unknown; label?: unknown };
      if (typeof model.id !== "string" || (model.label != null && typeof model.label !== "string")) throw new Error("invalid model fields");
      return validateClaudeGatewayModel({ id: model.id, ...(typeof model.label === "string" ? { label: model.label } : {}) });
    });
    const unique = new Map(models.map((model) => [model.id, model]));
    return [...unique.values()];
  } catch (error) {
    throw new Error(`Claude model gateway ${field} setting is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseCatalog(value: string | undefined): ClaudeModelGatewayCatalogCache {
  if (!value?.trim()) return { models: [], updatedAt: null };
  try {
    const parsed = JSON.parse(value) as { models?: unknown; updatedAt?: unknown };
    return {
      models: parseModels(JSON.stringify(parsed.models ?? []), "catalog", []),
      updatedAt: typeof parsed.updatedAt === "string" && Number.isFinite(Date.parse(parsed.updatedAt))
        ? new Date(parsed.updatedAt).toISOString()
        : null,
    };
  } catch (error) {
    throw new Error(`Claude model gateway catalog setting is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await db.select().from(settings).where(inArray(settings.key, Object.values(CLAUDE_MODEL_GATEWAY_SETTING_KEYS)));
  return new Map<string, string>(rows.map((row) => [String(row.key), String(row.value)]));
}

export async function readClaudeModelGatewaySettings(): Promise<ClaudeModelGatewaySettings> {
  const rows = await readRows();
  const modeValue = rows.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.mode);
  const mode = modeValue === "external" ? "external" : "managed";
  const decrypt = (key: string) => {
    const value = rows.get(key);
    return value ? decryptSettingValue(value) : "";
  };
  return {
    mode,
    enabled: parseBoolean(rows.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.enabled), false),
    baseUrl: normalizeClaudeGatewayBaseUrl(rows.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.baseUrl) ?? "http://127.0.0.1:8317"),
    apiToken: decrypt(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.apiToken),
    managementToken: decrypt(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.managementToken),
    customModels: parseModels(
      rows.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.models),
      "models",
      DEFAULT_CLAUDE_GATEWAY_MODELS.map((model) => ({ ...model })),
    ),
    catalog: parseCatalog(rows.get(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.catalogCache)),
  };
}

async function upsertSetting(key: string, value: string) {
  await db.insert(settings).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function saveClaudeModelGatewaySettings(input: Partial<{
  mode: ClaudeModelGatewayMode;
  enabled: boolean;
  baseUrl: string;
  apiToken: string;
  managementToken: string;
  customModels: ClaudeGatewayModelInput[];
}>) {
  if (input.mode !== undefined) {
    if (input.mode !== "managed" && input.mode !== "external") throw new Error("Invalid Claude model gateway mode.");
    await upsertSetting(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.mode, input.mode);
  }
  if (input.enabled !== undefined) await upsertSetting(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.enabled, String(input.enabled));
  if (input.baseUrl !== undefined) await upsertSetting(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.baseUrl, normalizeClaudeGatewayBaseUrl(input.baseUrl));
  for (const [key, value] of [
    [CLAUDE_MODEL_GATEWAY_SETTING_KEYS.apiToken, input.apiToken],
    [CLAUDE_MODEL_GATEWAY_SETTING_KEYS.managementToken, input.managementToken],
  ] as const) {
    if (value === undefined || value.trim() === "") continue;
    await upsertSetting(key, encryptSettingValue(value.trim()));
  }
  if (input.customModels !== undefined) {
    const models = input.customModels.map(validateClaudeGatewayModel);
    await upsertSetting(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.models, JSON.stringify([...new Map(models.map((model) => [model.id, model])).values()]));
  }
  return readClaudeModelGatewaySettings();
}

function generatedToken() {
  return `omni-${randomBytes(32).toString("base64url")}`;
}

export async function writeProvisionalManagedGatewaySettings() {
  const current = await readClaudeModelGatewaySettings();
  return saveClaudeModelGatewaySettings({
    mode: "managed",
    enabled: false,
    baseUrl: current.mode === "managed" ? current.baseUrl : "http://127.0.0.1:8317",
    apiToken: current.apiToken || generatedToken(),
    managementToken: current.managementToken || generatedToken(),
    customModels: current.customModels,
  });
}

export async function saveClaudeModelGatewayCatalog(models: ClaudeGatewayModelInput[], updatedAt = new Date()) {
  const validated = models.map(validateClaudeGatewayModel);
  await upsertSetting(CLAUDE_MODEL_GATEWAY_SETTING_KEYS.catalogCache, JSON.stringify({
    models: [...new Map(validated.map((model) => [model.id, model])).values()],
    updatedAt: updatedAt.toISOString(),
  }));
}

export async function clearClaudeModelGatewaySettingsForTests() {
  await db.delete(settings).where(eq(settings.key, CLAUDE_MODEL_GATEWAY_SETTING_KEYS.catalogCache));
}
