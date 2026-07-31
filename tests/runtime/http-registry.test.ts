import { describe, expect, it } from "vitest";
import { createOmniHttpRegistry } from "@/runtime/http/registry";

describe("createOmniHttpRegistry", () => {
  it("dispatches registered fetch-style handlers by method and pathname", async () => {
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/runtime/status", async (_request, context) =>
        Response.json({
          ok: true,
          surface: context.surface,
        }),
      );

    const response = await registry.handle(
      new Request("http://localhost/api/runtime/status?ignored=1", { method: "GET" }),
      { surface: "web" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, surface: "web" });
  });

  it("returns deterministic errors for unregistered routes", async () => {
    const registry = createOmniHttpRegistry();

    const response = await registry.handle(
      new Request("http://localhost/api/missing", { method: "POST" }),
      { surface: "web" },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "route.not_found",
        message: "No runtime route registered for POST /api/missing.",
        surface: "web",
      },
    });
  });

  it("dispatches colon-parameter routes with decoded params in context", async () => {
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/agents/:name", async (_request, context) =>
        Response.json({
          name: context.params?.name,
        }),
      );

    const response = await registry.handle(
      new Request("http://localhost/api/agents/worker%201", { method: "GET" }),
      { surface: "web" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: "worker 1" });
  });

  it("lists route metadata and derives OPTIONS from the matching registry entries", async () => {
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/items/:id", () => Response.json({ ok: true }), {
        auth: "session",
        responseKind: "json",
      })
      .route("PATCH", "/api/items/:id", () => Response.json({ ok: true }), {
        auth: "session",
        responseKind: "json",
      });

    expect(registry.listRoutes()).toEqual([
      {
        method: "GET",
        pathname: "/api/items/:id",
        auth: "session",
        responseKind: "json",
      },
      {
        method: "PATCH",
        pathname: "/api/items/:id",
        auth: "session",
        responseKind: "json",
      },
    ]);

    const options = await registry.handle(
      new Request("http://localhost/api/items/one", { method: "OPTIONS" }),
      { surface: "web" },
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("GET, OPTIONS, PATCH");
  });
});
