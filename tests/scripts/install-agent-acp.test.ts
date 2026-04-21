import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";

function writeExecutable(filePath: string, contents: string) {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeBin(name: string, binDir: string, body = "#!/bin/sh\nexit 0\n") {
  writeExecutable(path.join(binDir, name), body);
}

describe("install-agent-acp.sh", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports native ACP support in dry-run mode and plans the Claude adapter install", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("claude", binDir);
    createFakeBin("gemini", binDir);
    createFakeBin("opencode", binDir);
    createFakeBin("npm", binDir);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH || ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("codex: detected");
    expect(result.stdout).toContain("native bridge support via `codex mcp-server`");
    expect(result.stdout).toContain("claude: detected");
    expect(result.stdout).toContain("would install `@agentclientprotocol/claude-agent-acp`");
    expect(result.stdout).toContain("gemini: detected");
    expect(result.stdout).toContain("native ACP support via `gemini --experimental-acp`");
    expect(result.stdout).toContain("opencode: detected");
    expect(result.stdout).toContain("native ACP support via `opencode acp`");
  });

  it("installs only the missing Claude ACP adapter when Claude is present", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const npmLogPath = path.join(tempDir, "npm.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("claude", binDir);
    createFakeBin("claude-agent-acp", binDir, "#!/usr/bin/env bash\nexit 1\n");
    fs.rmSync(path.join(binDir, "claude-agent-acp"));
    createFakeBin(
      "npm",
      binDir,
      `#!/bin/sh
echo "$@" >> "${npmLogPath}"
exit 0
`,
    );

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH || ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(npmLogPath, "utf8")).toContain("install -g @agentclientprotocol/claude-agent-acp");
    expect(result.stdout).toContain("installed `@agentclientprotocol/claude-agent-acp`");
    expect(result.stdout).toContain("codex: detected");
  });
});
