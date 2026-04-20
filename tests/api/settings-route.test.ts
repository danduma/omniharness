import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { GET, POST } from "@/app/api/settings/route";

describe("/api/settings", () => {
  it("stores encrypted values and returns decrypted values to the client", async () => {
    process.env.OMNIHARNESS_SETTINGS_KEY = Buffer.alloc(32, 3).toString("base64");

    const saveRequest = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        SUPERVISOR_LLM_API_KEY: "top-secret-key",
        SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
      }),
    });

    const saveResponse = await POST(saveRequest);
    expect(saveResponse.status).toBe(200);

    const storedApiKey = await db.select().from(settings).where(eq(settings.key, "SUPERVISOR_LLM_API_KEY")).get();
    const storedModel = await db.select().from(settings).where(eq(settings.key, "SUPERVISOR_LLM_MODEL")).get();

    expect(storedApiKey?.value).toMatch(/^enc:v1:/);
    expect(storedApiKey?.value).not.toContain("top-secret-key");
    expect(storedModel?.value).toMatch(/^enc:v1:/);
    expect(storedModel?.value).not.toContain("gemini-3.1-pro-preview");

    const getResponse = await GET();
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json();
    expect(payload.SUPERVISOR_LLM_API_KEY).toBe("top-secret-key");
    expect(payload.SUPERVISOR_LLM_MODEL).toBe("gemini-3.1-pro-preview");
  });
});
