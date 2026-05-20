import { describe, expect, it } from "vitest";
import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { createRuntimeRequestContext } from "@/runtime/http/context";

describe("runtime HTTP adapters", () => {
  it("adapts portable handlers to Next-style route functions", async () => {
    const GET = adaptOmniHandlerToNext((request, context) => {
      const url = new URL(request.url);
      return Response.json({
        q: url.searchParams.get("q"),
        surface: context.surface,
      });
    }, { surface: "vscode" });

    const response = await GET(new Request("http://localhost/api/example?q=hello"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ q: "hello", surface: "vscode" });
  });

  it("builds a stable request context for portable handlers", () => {
    const context = createRuntimeRequestContext({ surface: "electron" });

    expect(context.surface).toBe("electron");
  });
});
