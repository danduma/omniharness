import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePnpmArgs, resolvePnpmCommand } from "../../scripts/package-manager-command";

describe("package-manager command resolution", () => {
  it("runs pnpm through cmd.exe when Node launches it on Windows", () => {
    expect(resolvePnpmCommand("win32")).toBe("cmd.exe");
    expect(resolvePnpmArgs(["exec", "tsx", "scripts/agent-runtime.ts"], "win32")).toEqual([
      "/d",
      "/s",
      "/c",
      "pnpm",
      "exec",
      "tsx",
      "scripts/agent-runtime.ts",
    ]);
  });

  it("uses pnpm on non-Windows platforms", () => {
    expect(resolvePnpmCommand("darwin")).toBe("pnpm");
    expect(resolvePnpmArgs(["build"], "darwin")).toEqual(["build"]);
    expect(resolvePnpmCommand("linux")).toBe("pnpm");
    expect(resolvePnpmArgs(["install"], "linux")).toEqual(["install"]);
  });

  it("allows node-pty postinstall scripts without an interactive pnpm approve-builds prompt", () => {
    const workspaceConfig = fs.readFileSync(path.join(process.cwd(), "pnpm-workspace.yaml"), "utf8");

    expect(workspaceConfig).toMatch(/allowBuilds:\s*(?:\r?\n\s+.+)*\r?\n\s+node-pty:\s+true/);
  });
});
