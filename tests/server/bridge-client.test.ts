import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockNotifyEventStreamSubscribers } = vi.hoisted(() => ({
  mockNotifyEventStreamSubscribers: vi.fn(),
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
}));

describe("bridge client", () => {
  const originalFetch = global.fetch;
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
    mockNotifyEventStreamSubscribers.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    warnSpy.mockClear();
  });

  it("retries transient bridge failures and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "worker-1", state: "idle" }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    const request = spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await request;

    expect(result).toEqual({ name: "worker-1", state: "idle" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails fast on getAgent when retries are explicitly disabled", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError(
        "fetch failed",
        { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) },
      ),
    );
    global.fetch = fetchMock as typeof fetch;

    const { getAgent } = await import("@/server/bridge-client");

    await expect(getAgent("worker-1", { retryIndefinitely: false })).rejects.toThrow(/Get agent failed:/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a clear runtime message when the local runtime is down", async () => {
    vi.useFakeTimers();
    const refused = new TypeError(
      "fetch failed",
      { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:7800"), { code: "ECONNREFUSED" }) },
    );
    const fetchMock = vi.fn().mockRejectedValue(refused);
    global.fetch = fetchMock as typeof fetch;

    const { askAgent } = await import("@/server/bridge-client");

    const expectation = expect(askAgent("worker-1", "hello")).rejects.toThrow(/OmniHarness agent runtime is not running at http:\/\/127\.0\.0\.1:7800/i);
    await vi.advanceTimersByTimeAsync(3000);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses the ask stream and wakes live subscribers for incremental worker output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response([
        "event: progress",
        "data: {\"updatedAt\":\"2026-05-10T00:00:00.000Z\"}",
        "",
        "event: chunk",
        "data: {\"chunk\":\"hello\"}",
        "",
        "event: done",
        "data: {\"response\":\"hello\",\"state\":\"idle\",\"stopReason\":\"end_turn\"}",
        "",
      ].join("\n"), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { askAgent } = await import("@/server/bridge-client");
    const result = await askAgent("worker-1", "hello");

    expect(result).toEqual({
      response: "hello",
      state: "idle",
      stopReason: "end_turn",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:7800/agents/worker-1/ask?stream=true",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(3);
  });

  it("uses streamed chunks as the response fallback when done omits response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response([
        "event: chunk",
        "data: {\"chunk\":\"hello \"}",
        "",
        "event: chunk",
        "data: {\"chunk\":\"world\"}",
        "",
        "event: done",
        "data: {\"state\":\"idle\",\"stopReason\":\"end_turn\"}",
        "",
      ].join("\n"), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { askAgent } = await import("@/server/bridge-client");
    const result = await askAgent("worker-1", "hello");

    expect(result).toEqual({
      response: "hello world",
      state: "idle",
      stopReason: "end_turn",
    });
  });

  it("does not retry a busy worker ask so callers can defer the prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Agent is busy: worker-1" }), {
        status: 409,
        statusText: "Conflict",
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { askAgent } = await import("@/server/bridge-client");

    await expect(askAgent("worker-1", "hello")).rejects.toThrow(/^Ask failed: Agent is busy: worker-1$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
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

  it("does not retry malformed agent session handshakes returned as http 500s", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Agent session did not include a session id." }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");

    await expect(spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" })).rejects.toThrow(
      /^Spawn failed: Agent session did not include a session id\.$/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("retries transient bridge socket-closure errors returned as http 500s", async () => {
    vi.useFakeTimers();
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
    const request = spawnAgent({ type: "codex", cwd: "/tmp", name: "worker-1" });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await request;

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

  it("omits the Gemini model override for the Gemini 3 CLI-default option", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "worker-1", state: "idle" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { spawnAgent } = await import("@/server/bridge-client");
    await spawnAgent({
      type: "gemini",
      cwd: "/tmp",
      name: "worker-1",
      model: "gemini-3",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.type).toBe("gemini");
    expect(body.model).toBeUndefined();
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

  it("keeps retrying recoverable agent snapshot polling until the bridge returns", async () => {
    vi.useFakeTimers();
    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "worker-1", state: "working" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const { getAgent } = await import("@/server/bridge-client");

    const expectation = expect(getAgent("worker-1")).resolves.toMatchObject({ name: "worker-1", state: "working" });
    await vi.advanceTimersByTimeAsync(7000);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("Get agent /agents/worker-1");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("retrying indefinitely");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("next delay 1000ms");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("max delay 900000ms");
    expect(warnSpy.mock.calls[0]).toHaveLength(1);
  });
});
