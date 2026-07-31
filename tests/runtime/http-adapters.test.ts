import { describe, expect, it } from "vitest";
import { createRuntimeRequestContext } from "@/runtime/http/context";
import { createOmniHttpRegistry } from "@/runtime/http/registry";

describe("runtime HTTP adapters", () => {
  it("dispatches portable handlers through the shared registry", async () => {
    const registry = createOmniHttpRegistry().route("GET", "/api/example", (request, context) => {
      const url = new URL(request.url);
      return Response.json({
        q: url.searchParams.get("q"),
        surface: context.surface,
      });
    });

    const response = await registry.handle(
      new Request("http://localhost/api/example?q=hello"),
      createRuntimeRequestContext({ surface: "vscode" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ q: "hello", surface: "vscode" });
  });

  it("builds a stable request context for portable handlers", () => {
    const context = createRuntimeRequestContext({ surface: "electron" });

    expect(context.surface).toBe("electron");
  });
});
