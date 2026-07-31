import { describe, expect, it } from "vitest";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";

describe("runner health route", () => {
  it("is minimal, state-free, unauthenticated, and cross-origin readable", async () => {
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request(
      "http://runner.example/api/healthz",
      {
        headers: {
          origin: "https://interface.example",
          authorization: "Bearer invalid",
        },
      },
    ), { surface: "web" });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("derives health OPTIONS from registry metadata", async () => {
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request(
      "http://runner.example/api/healthz",
      { method: "OPTIONS" },
    ), { surface: "web" });

    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
  });
});
