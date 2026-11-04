import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";

describe("agent runtime doctor command resolution", () => {
  it("reports the exact command path used to mark Codex installed", async () => {
    const binDir = mkdtempSync(join(tmpdir(), "omni-doctor-codex-"));
    const command = join(binDir, process.platform === "win32" ? "codex-acp.cmd" : "codex-acp");
    writeFileSync(command, process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\n", "utf8");
    chmodSync(command, 0o755);

    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: binDir,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      },
    });

    const doctor = await manager.doctor();
    const codex = doctor.results.find((result) => result.type === "codex");

    expect(codex).toMatchObject({
      binary: true,
      command,
    });
  });
});
