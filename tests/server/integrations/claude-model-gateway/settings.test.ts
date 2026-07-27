import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CLAUDE_MODEL_GATEWAY_SETTING_KEYS } from "@/lib/claude-model-gateway";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { decryptSettingValue } from "@/server/settings/crypto";
import {
  readClaudeModelGatewaySettings,
  saveClaudeModelGatewayCatalog,
  saveClaudeModelGatewaySettings,
  writeProvisionalManagedGatewaySettings,
} from "@/server/integrations/claude-model-gateway/settings";

const gatewayKeys = Object.values(CLAUDE_MODEL_GATEWAY_SETTING_KEYS);
let previousKey: string | undefined;

beforeEach(async () => {
  previousKey = process.env.OMNIHARNESS_SETTINGS_KEY;
  process.env.OMNIHARNESS_SETTINGS_KEY = Buffer.alloc(32, 7).toString("base64");
  await db.delete(settings).where(inArray(settings.key, gatewayKeys));
});

afterEach(async () => {
  await db.delete(settings).where(inArray(settings.key, gatewayKeys));
  if (previousKey === undefined) delete process.env.OMNIHARNESS_SETTINGS_KEY;
  else process.env.OMNIHARNESS_SETTINGS_KEY = previousKey;
});

describe("Claude gateway settings", () => {
  test("returns safe managed defaults including the requested model", async () => {
    await expect(readClaudeModelGatewaySettings()).resolves.toMatchObject({
      mode: "managed",
      enabled: false,
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "",
      managementToken: "",
      customModels: [{ id: "gpt-5.6-sol", label: "GPT-5.6 SOL" }],
      catalog: { models: [], updatedAt: null },
    });
  });

  test("encrypts tokens, preserves an existing token on an empty replacement, and parses models", async () => {
    await saveClaudeModelGatewaySettings({
      mode: "external",
      enabled: true,
      baseUrl: "http://127.0.0.1:9000/",
      apiToken: "api-secret",
      managementToken: "management-secret",
      customModels: [{ id: "team/model", label: "Team Model" }],
    });
    await saveClaudeModelGatewaySettings({ apiToken: "", managementToken: "" });

    const apiRow = await db.select().from(settings).where(eq(settings.key, CLAUDE_MODEL_GATEWAY_SETTING_KEYS.apiToken)).get();
    const managementRow = await db.select().from(settings).where(eq(settings.key, CLAUDE_MODEL_GATEWAY_SETTING_KEYS.managementToken)).get();
    expect(apiRow?.value).not.toContain("api-secret");
    expect(managementRow?.value).not.toContain("management-secret");
    expect(decryptSettingValue(apiRow?.value ?? "")).toBe("api-secret");
    expect(decryptSettingValue(managementRow?.value ?? "")).toBe("management-secret");
    await expect(readClaudeModelGatewaySettings()).resolves.toMatchObject({
      mode: "external",
      enabled: true,
      baseUrl: "http://127.0.0.1:9000",
      apiToken: "api-secret",
      managementToken: "management-secret",
      customModels: [{ id: "team/model", label: "Team Model" }],
    });
  });

  test("creates provisional disabled managed credentials once and reuses them on retry", async () => {
    const first = await writeProvisionalManagedGatewaySettings();
    const second = await writeProvisionalManagedGatewaySettings();
    expect(first.enabled).toBe(false);
    expect(first.apiToken).toMatch(/^omni-/);
    expect(first.managementToken).toMatch(/^omni-/);
    expect(second.apiToken).toBe(first.apiToken);
    expect(second.managementToken).toBe(first.managementToken);
  });

  test("keeps catalog cache internal and rejects malformed stored values", async () => {
    await saveClaudeModelGatewayCatalog([{ id: "discovered/model", label: "Discovered" }], new Date("2026-07-13T00:00:00.000Z"));
    const loaded = await readClaudeModelGatewaySettings();
    expect(loaded.catalog).toEqual({
      models: [{ id: "discovered/model", label: "Discovered" }],
      updatedAt: "2026-07-13T00:00:00.000Z",
    });

    await db.insert(settings).values({
      key: CLAUDE_MODEL_GATEWAY_SETTING_KEYS.models,
      value: "not-json",
      updatedAt: new Date(),
    }).onConflictDoUpdate({ target: settings.key, set: { value: "not-json", updatedAt: new Date() } });
    await expect(readClaudeModelGatewaySettings()).rejects.toThrow(/models setting/i);
  });
});
