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
});
