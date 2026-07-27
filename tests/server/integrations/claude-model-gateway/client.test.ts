import { createServer, type RequestListener } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { createClaudeModelGatewayClient } from "@/server/integrations/claude-model-gateway/client";

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function startFixture(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture did not start");
  return `http://127.0.0.1:${address.port}`;
}

describe("Claude model gateway client", () => {
  test("lists and deduplicates models using the data-plane bearer token", async () => {
    const baseUrl = await startFixture((request, response) => {
      expect(request.url).toBe("/v1/models");
      expect(request.headers.authorization).toBe("Bearer api-token");
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [
        { id: "gpt-5.6-sol", display_name: "GPT SOL" },
        { id: "gpt-5.6-sol", display_name: "Duplicate" },
        { id: "team/model" },
      ] }));
    });

    const client = createClaudeModelGatewayClient({ baseUrl, apiToken: "api-token", managementToken: "mgmt-token" });
    await expect(client.listModels()).resolves.toEqual([
      { id: "gpt-5.6-sol", label: "GPT SOL" },
      { id: "team/model" },
    ]);
  });

  test("creates a Codex OAuth URL and checks completion using only the management token", async () => {
    const seen: string[] = [];
    const baseUrl = await startFixture((request, response) => {
      expect(request.headers.authorization).toBe("Bearer mgmt-token");
      expect(request.headers.authorization).not.toContain("api-token");
      seen.push(request.url ?? "");
      response.setHeader("content-type", "application/json");
      if (request.url?.startsWith("/v0/management/codex-auth-url")) {
        response.end(JSON.stringify({ status: "ok", url: "https://auth.example/flow", state: "oauth-state" }));
      } else {
        response.end(JSON.stringify({ files: [
          { name: "codex-user.json", type: "codex", disabled: false },
          { name: "other.json", type: "gemini", disabled: false },
        ] }));
      }
    });
    const client = createClaudeModelGatewayClient({ baseUrl, apiToken: "api-token", managementToken: "mgmt-token" });
    await expect(client.createCodexOAuthUrl()).resolves.toEqual({ url: "https://auth.example/flow", state: "oauth-state" });
    await expect(client.isCodexOAuthConnected()).resolves.toBe(true);
    expect(seen).toContain("/v0/management/codex-auth-url?is_webui=true");
    expect(seen).toContain("/v0/management/auth-files");
  });

  test("bounds requests and never includes tokens in public errors", async () => {
    const baseUrl = await startFixture(() => undefined);
    const client = createClaudeModelGatewayClient({
      baseUrl,
      apiToken: "super-secret-api",
      managementToken: "super-secret-management",
      timeoutMs: 30,
    });
    let error: unknown;
    try {
      await client.listModels();
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : "";
    expect(message).toMatch(/timed out/i);
    expect(message).not.toContain("super-secret-api");
    expect(message).not.toContain("super-secret-management");
  });

  test.each([
    "javascript:alert(1)",
    "https://user:secret@auth.example/flow",
    "http://auth.example/flow",
  ])("rejects unsafe OAuth URL %s", async (oauthUrl) => {
    const baseUrl = await startFixture((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ url: oauthUrl, state: "oauth-state" }));
    });
    const client = createClaudeModelGatewayClient({ baseUrl, apiToken: "api-token", managementToken: "mgmt-token" });
    await expect(client.createCodexOAuthUrl()).rejects.toThrow(/unsafe|invalid/i);
  });

  test("rejects malformed model responses", async () => {
    const baseUrl = await startFixture((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "bad\nmodel" }] }));
    });
    const client = createClaudeModelGatewayClient({ baseUrl, apiToken: "api-token", managementToken: "mgmt-token" });
    await expect(client.listModels()).rejects.toThrow(/model/i);
  });
});
