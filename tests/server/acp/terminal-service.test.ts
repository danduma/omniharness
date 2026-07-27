import { describe, expect, it } from "vitest";
import { TerminalService } from "@/server/agent-runtime/acp/terminal-service";

describe("ACP terminal service", () => {
  it("creates, reads, waits for, kills, and releases bounded terminals", async () => {
    const service = new TerminalService();
    const created = await service.create({
      sessionId: "s1",
      command: process.execPath,
      args: ["-e", "process.stdout.write('hello')"],
      outputByteLimit: 4,
    });

    const exit = await service.wait({ sessionId: "s1", terminalId: created.terminalId });
    expect(exit.exitCode).toBe(0);
    expect(await service.output({ sessionId: "s1", terminalId: created.terminalId })).toEqual({
      output: "ello",
      truncated: true,
      exitStatus: { exitCode: 0, signal: null },
    });
    await service.kill({ sessionId: "s1", terminalId: created.terminalId });
    await service.release({ sessionId: "s1", terminalId: created.terminalId });
    expect(service.size).toBe(0);
  });
});
