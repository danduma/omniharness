import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

vi.mock("@/server/settings/crypto", () => ({
  shouldEncryptSetting: (key: string) => key.endsWith("_API_KEY"),
  encryptSettingValue: (value: string) => `encmock:${Buffer.from(value, "utf8").toString("base64")}`,
  decryptSettingValue: (value: string) => {
    if (value === "enc:v1:invalid-payload") {
      throw new Error("Unable to decrypt stored setting value.");
    }
    return value.startsWith("encmock:")
      ? Buffer.from(value.slice("encmock:".length), "base64").toString("utf8")
      : value;
  },
}));

import { GET, POST } from "@/app/api/settings/route";

describe("/api/settings", () => {
  beforeEach(async () => {
    await db.delete(settings);
  });

  it("stores encrypted values and returns decrypted values to the client", async () => {
    const saveRequest = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        TEST_SUPERVISOR_API_KEY: "top-secret-key",
        TEST_SUPERVISOR_MODEL: "gemini-3.1-pro-preview",
      }),
    });

    const saveResponse = await POST(saveRequest);
    expect(saveResponse.status).toBe(200);

    const storedApiKey = await db.select().from(settings).where(eq(settings.key, "TEST_SUPERVISOR_API_KEY")).get();
    const storedModel = await db.select().from(settings).where(eq(settings.key, "TEST_SUPERVISOR_MODEL")).get();

    expect(storedApiKey?.value).toBe(`encmock:${Buffer.from("top-secret-key", "utf8").toString("base64")}`);
    expect(storedApiKey?.value).not.toContain("top-secret-key");
    expect(storedModel?.value).toBe("gemini-3.1-pro-preview");

    const getResponse = await GET();
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json();
    expect(payload.values.TEST_SUPERVISOR_API_KEY).toBe("top-secret-key");
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("gemini-3.1-pro-preview");
    expect(payload.diagnostics).toEqual([]);
  });

  it("does not fail the whole response when an old encrypted secret cannot be decrypted", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await db.insert(settings).values([
      { key: "TEST_SUPERVISOR_API_KEY", value: "enc:v1:invalid-payload", updatedAt: new Date() },
      { key: "TEST_SUPERVISOR_MODEL", value: "enc:v1:invalid-payload", updatedAt: new Date() },
      { key: "TEST_CREDIT_STRATEGY", value: "swap_account", updatedAt: new Date() },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.values.TEST_SUPERVISOR_API_KEY).toBe("");
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("enc:v1:invalid-payload");
    expect(payload.values.TEST_CREDIT_STRATEGY).toBe("swap_account");
    expect(payload.diagnostics).toEqual([
      expect.objectContaining({
        source: "Settings",
        action: "Load saved settings",
        message: 'Unable to decrypt setting "TEST_SUPERVISOR_API_KEY".',
      }),
    ]);

    warnSpy.mockRestore();
  });
});
