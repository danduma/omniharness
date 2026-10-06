import { describe, expect, it } from "vitest";
import { buildStartupCommands, runStartupChecks } from "../../scripts/ensure-startup.mjs";

describe("startup checks", () => {
  it("runs the managed agent refresh before the interface freshness check on Unix", () => {
    expect(buildStartupCommands({ root: "/repo", platform: "darwin" })).toEqual([
      {
        command: "/bin/bash",
        args: ["/repo/scripts/install-agent-acp.sh", "--ensure-only"],
      },
      {
        command: process.execPath,
        args: ["/repo/scripts/ensure-interface-build.mjs"],
      },
    ]);
  });

  it("uses the PowerShell installer on Windows", () => {
    expect(buildStartupCommands({ root: "C:\\repo", platform: "win32" })).toEqual([
      {
        command: "powershell.exe",
        args: [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          "C:\\repo\\scripts\\install-agent-acp.ps1",
          "-EnsureOnly",
        ],
      },
      {
        command: process.execPath,
        args: ["C:\\repo\\scripts\\ensure-interface-build.mjs"],
      },
    ]);
  });

  it("does not start the interface check when agent setup fails", () => {
    const calls: string[] = [];
    const status = runStartupChecks({
      root: "/repo",
      platform: "darwin",
      run: (command, args) => {
        calls.push([command, ...args].join(" "));
        return { status: 17 };
      },
    });

    expect(status).toBe(17);
    expect(calls).toEqual([
      "/bin/bash /repo/scripts/install-agent-acp.sh --ensure-only",
    ]);
  });
});
