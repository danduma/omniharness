import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type ClaudeGatewayFixture = Awaited<ReturnType<typeof startClaudeGatewayFixture>>;

export async function startClaudeGatewayFixture() {
  const apiToken = "fixture-api-token";
  const managementToken = "fixture-management-token";
  let available = true;
  let connected = false;
  const anthropicRequests: Array<Record<string, unknown>> = [];

  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(body));
  };
  const readBody = async (request: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
  };
  const server = createServer(async (request, response) => {
    if (!available) return json(response, 503, { error: "fixture unavailable" });
    const authorization = request.headers.authorization;
    if (request.url === "/v1/models") {
      if (authorization !== `Bearer ${apiToken}`) return json(response, 401, { error: "unauthorized" });
      return json(response, 200, { data: [{ id: "gpt-5.6-sol", display_name: "GPT-5.6 SOL" }, { id: "fixture/other" }] });
    }
    if (request.url === "/v0/management/codex-auth-url?is_webui=true") {
      if (authorization !== `Bearer ${managementToken}`) return json(response, 401, { error: "unauthorized" });
      return json(response, 200, { status: "ok", url: "https://auth.example/fixture", state: "fixture-state" });
    }
    if (request.url === "/v0/management/auth-files") {
      if (authorization !== `Bearer ${managementToken}`) return json(response, 401, { error: "unauthorized" });
      return json(response, 200, { files: connected ? [{ name: "fixture.json", type: "codex", disabled: false }] : [] });
    }
    if (request.url === "/v1/messages" && request.method === "POST") {
      if (authorization !== `Bearer ${apiToken}`) return json(response, 401, { error: "unauthorized" });
      anthropicRequests.push(await readBody(request));
      return json(response, 200, { id: "fixture-message", type: "message", role: "assistant", content: [{ type: "text", text: "ok" }] });
    }
    return json(response, 404, { error: "not found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Claude gateway fixture did not start.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiToken,
    managementToken,
    anthropicRequests,
    setAvailable(value: boolean) { available = value; },
    completeOAuth() { connected = true; },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
