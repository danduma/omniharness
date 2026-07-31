import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { runOmniCli } from "@/server/cli/runner";

const { createConversationMock, ensureSupervisorRuntimeStartedMock } = vi.hoisted(() => ({
  createConversationMock: vi.fn(),
  ensureSupervisorRuntimeStartedMock: vi.fn(),
}));

vi.mock("@/server/conversations/create", () => ({
  createConversation: createConversationMock,
}));

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: ensureSupervisorRuntimeStartedMock,
}));

function createIo() {
  const stdout = { text: "", write(chunk: string) { this.text += chunk; return true; } };
  const stderr = { text: "", write(chunk: string) { this.text += chunk; return true; } };
  return { stdout, stderr };
}

describe("runOmniCli", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
    createConversationMock.mockReset();
    ensureSupervisorRuntimeStartedMock.mockReset();
  });

  it("starts the shared runtime kernel before creating a conversation", async () => {
    createConversationMock.mockResolvedValue({
      mode: "direct",
      runId: "run-cli",
      planId: "plan-cli",
    });
    const io = createIo();

    const exitCode = await runOmniCli(["--no-watch", "hello from cli"], io);

    expect(exitCode).toBe(0);
    expect(ensureSupervisorRuntimeStartedMock).toHaveBeenCalledOnce();
    expect(createConversationMock).toHaveBeenCalledWith(expect.objectContaining({
      command: "hello from cli",
      mode: "direct",
    }));
    expect(io.stdout.text).toContain("Started direct conversation run-cli");
    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toEqual([
      expect.objectContaining({
        kind: "runtime.started",
        surface: "cli",
        label: "Omni CLI",
      }),
      expect.objectContaining({
        kind: "runtime.stopped",
        surface: "cli",
        reason: "shutdown",
      }),
    ]);
  });

  it("creates a conversation on a remote runner using OMNI_TOKEN without starting a local runtime", async () => {
    const originalToken = process.env.OMNI_TOKEN;
    process.env.OMNI_TOKEN = "remote-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      runId: "run-remote",
      planId: "plan-remote",
      mode: "direct",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const io = createIo();

    try {
      const exitCode = await runOmniCli([
        "--runner",
        "https://runner.example.test",
        "--no-watch",
        "inspect remotely",
      ], io);

      expect(exitCode).toBe(0);
      expect(createConversationMock).not.toHaveBeenCalled();
      expect(ensureSupervisorRuntimeStartedMock).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("https://runner.example.test/api/conversations"),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer remote-secret",
          }),
        }),
      );
      expect(io.stdout.text).toContain("run-remote");
      expect(io.stdout.text).not.toContain("remote-secret");
      expect(io.stderr.text).not.toContain("remote-secret");
    } finally {
      fetchMock.mockRestore();
      if (originalToken === undefined) {
        delete process.env.OMNI_TOKEN;
      } else {
        process.env.OMNI_TOKEN = originalToken;
      }
    }
  });
});
