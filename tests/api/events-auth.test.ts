import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/route";

describe("GET /api/events auth", () => {
  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
  });

  it("rejects unauthenticated event streams when auth is enabled", async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";

    const response = await GET(new NextRequest("http://localhost/api/events"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Events",
        action: "Stream live updates",
        message: "Authentication required.",
      }),
    });
  });
});
