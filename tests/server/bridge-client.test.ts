import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("bridge client", () => {
  const originalFetch = global.fetch;
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockClear();
  });

  it("retries transient bridge failures and succeeds on a later attempt", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "worker-1", state: "idle" }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    const result = await spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" });

    expect(result).toEqual({ name: "worker-1", state: "idle" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a clear runtime message when the local runtime is down", async () => {
    const refused = new TypeError(
      "fetch failed",
      { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:7800"), { code: "ECONNREFUSED" }) },
    );
    const fetchMock = vi.fn().mockRejectedValue(refused);
    global.fetch = fetchMock as typeof fetch;

    const { askAgent } = await import("@/server/bridge-client");

    await expect(askAgent("worker-1", "hello")).rejects.toThrow(/OmniHarness agent runtime is not running at http:\/\/127\.0\.0\.1:7800/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("preserves structured bridge error messages instead of collapsing them to status text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "claude-code binary not found on PATH." }), {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");

    await expect(spawnAgent({ type: "claude-code", cwd: "/tmp", name: "worker-1" })).rejects.toThrow(
      /Spawn failed: claude-code binary not found on PATH/i,
    );
  });

  it("does not duplicate the action prefix when the bridge already returned one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Spawn failed: ANTHROPIC_API_KEY is not set." }), {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");

    await expect(spawnAgent({ type: "claude-code", cwd: "/tmp", name: "worker-1" })).rejects.toThrow(
      /^Spawn failed: ANTHROPIC_API_KEY is not set\.$/i,
    );
  });

  it("does not retry deterministic bridge spawn failures returned as http 500s", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Spawn failed: failed to start agent" }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");

    await expect(spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" })).rejects.toThrow(
      /^Spawn failed: failed to start agent$/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("retries transient bridge socket-closure errors returned as http 500s", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "other side closed" }), {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    const result = await spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" });

    expect(result).toEqual({ name: "worker-1", state: "idle" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("passes requested model and effort through when spawning a worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "opencode",
      cwd: "/tmp",
      name: "worker-1",
      model: "openai/gpt-5.4",
      effort: "high",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toContain('"model":"openai/gpt-5.4"');
    expect(init?.body).toContain('"effort":"high"');
  });

  it("normalizes provider-prefixed GPT model ids before spawning a codex worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "codex",
      cwd: "/tmp",
      name: "worker-1",
      model: "openai/gpt-5.4",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toContain('"model":"gpt-5.4"');
    expect(init?.body).not.toContain('"model":"openai/gpt-5.4"');
  });

  it("normalizes newly advertised GPT model ids without hardcoded version entries", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "worker-2", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }));
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "codex",
      cwd: "/tmp",
      name: "worker-1",
      model: "openai/gpt-5.5",
    });
    await spawnAgent({
      type: "opencode",
      cwd: "/tmp",
      name: "worker-2",
      model: "gpt-5.5",
    });

    const [, codexInit] = fetchMock.mock.calls[0] ?? [];
    const [, openCodeInit] = fetchMock.mock.calls[1] ?? [];
    expect(codexInit?.body).toContain('"model":"gpt-5.5"');
    expect(codexInit?.body).not.toContain('"model":"openai/gpt-5.5"');
    expect(openCodeInit?.body).toContain('"model":"openai/gpt-5.5"');
  });

  it("passes resumeSessionId through when respawning a worker from saved history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "idle", sessionId: "session-123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "claude",
      cwd: "/tmp",
      name: "worker-1",
      resumeSessionId: "session-123",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toContain('"resumeSessionId":"session-123"');
  });

  it("passes skill roots and MCP servers through when spawning a worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "codex",
      cwd: "/tmp/project",
      name: "worker-1",
      skillRoots: ["/tmp/shared-skills"],
      mcpServers: [
        {
          type: "stdio",
          name: "chrome-devtools",
          command: "npx",
          args: ["chrome-devtools-mcp@latest"],
          env: [{ name: "SAMPLE", value: "1" }],
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.skillRoots).toEqual(["/tmp/shared-skills"]);
    expect(body.mcpServers).toEqual([
      {
        type: "stdio",
        name: "chrome-devtools",
        command: "npx",
        args: ["chrome-devtools-mcp@latest"],
        env: [{ name: "SAMPLE", value: "1" }],
      },
    ]);
  });

  it("normalizes sparse agent snapshots so missing text buffers do not crash callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "working" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { getAgent } = await import("@/server/bridge-client");
    const result = await getAgent("worker-1");

    expect(result).toMatchObject({
      name: "worker-1",
      state: "working",
      currentText: "",
      lastText: "",
      stderrBuffer: [],
      pendingPermissions: [],
      stopReason: null,
    });
  });
});
