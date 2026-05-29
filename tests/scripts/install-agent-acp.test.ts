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

  it("reports Codex and Claude adapter installs in dry-run mode", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("claude", binDir);
    createFakeBin("gemini", binDir);
    createFakeBin("opencode", binDir);
    createFakeBin("npm", binDir);
    createFakeBin("cargo", binDir);
    createFakeBin("rustup", binDir, `#!/bin/sh
if [ "$1" = "toolchain" ] && [ "$2" = "list" ]; then
  echo "stable-aarch64-apple-darwin"
  exit 0
fi
exit 0
`);
    createFakeBin("uname", binDir, `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo "Darwin"
elif [ "$1" = "-m" ]; then
  echo "arm64"
else
  echo "Darwin"
fi
`);
    createFakeBin("rg", binDir);
    createFakeBin("git", binDir);
    createFakeBin("node", binDir);
    createFakeBin("bash", binDir);
    createFakeBin("pnpm", binDir);
    createFakeBin("python3", binDir);
    createFakeBin("zsh", binDir);
    createFakeBin("jq", binDir);
    createFakeBin("gh", binDir);
    createFakeBin("uv", binDir);
    createFakeBin("fd", binDir);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("codex: detected");
    expect(result.stdout).toContain("would install `codex-acp` with `rustup run stable-aarch64-apple-darwin cargo install --locked --git https://github.com/danduma/codex-acp.git --branch main codex-acp`");
    expect(result.stdout).toContain("claude: detected");
    expect(result.stdout).toContain("would install `@agentclientprotocol/claude-agent-acp`");
    expect(result.stdout).toContain("gemini: detected");
    expect(result.stdout).toContain("native ACP support via `gemini --experimental-acp`");
    expect(result.stdout).toContain("opencode: detected");
    expect(result.stdout).toContain("native ACP support via `opencode acp`");
    expect(result.stdout).toContain("Checking agent tool environment");
    expect(result.stdout).toContain("Structured ACP filesystem tools are provided by the runtime");
    expect(result.stdout).toContain("Codex workers also get native Codex argv0 shims");
    expect(result.stdout).toContain("Codex core tools are enabled through a runtime managed config");
    expect(result.stdout).toContain("rg: detected");
    expect(result.stdout).toContain("git: detected");
    expect(result.stdout).toContain("node: detected");
  });

  it("installs the missing Codex and Claude ACP adapters when their CLIs are present", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const npmLogPath = path.join(tempDir, "npm.log");
    const cargoLogPath = path.join(tempDir, "cargo.log");
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
    createFakeBin(
      "rustup",
      binDir,
      `#!/bin/sh
echo "$@" >> "${cargoLogPath}"
exit 0
`,
    );
    createFakeBin("cargo", binDir);
    createFakeBin("uname", binDir, `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo "Darwin"
elif [ "$1" = "-m" ]; then
  echo "arm64"
else
  echo "Darwin"
fi
`);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(cargoLogPath, "utf8")).toContain("run stable-aarch64-apple-darwin cargo install --locked --git https://github.com/danduma/codex-acp.git --branch main codex-acp");
    expect(result.stdout).toContain("installed `codex-acp`");
    expect(fs.readFileSync(npmLogPath, "utf8")).toContain("install -g @agentclientprotocol/claude-agent-acp");
    expect(result.stdout).toContain("installed `@agentclientprotocol/claude-agent-acp`");
    expect(result.stdout).toContain("codex: detected");
  });

  it("skips refreshing an existing Codex ACP adapter when --ensure-only is set", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const cargoLogPath = path.join(tempDir, "cargo.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("codex-acp", binDir);
    createFakeBin("claude", binDir);
    createFakeBin("claude-agent-acp", binDir);
    createFakeBin(
      "rustup",
      binDir,
      `#!/bin/sh
echo "$@" >> "${cargoLogPath}"
exit 0
`,
    );
    createFakeBin("cargo", binDir);
    createFakeBin("uname", binDir, `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo "Darwin"
elif [ "$1" = "-m" ]; then
  echo "arm64"
else
  echo "Darwin"
fi
`);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--ensure-only"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("`codex-acp` already installed");
    expect(result.stdout).not.toContain("refreshing from the OmniHarness fork");
    expect(result.stdout).toContain("`claude-agent-acp` already installed");
    expect(fs.existsSync(cargoLogPath)).toBe(false);
  });

  it("refreshes an existing Codex ACP adapter from the OmniHarness fork", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const cargoLogPath = path.join(tempDir, "cargo.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("codex-acp", binDir);
    createFakeBin(
      "rustup",
      binDir,
      `#!/bin/sh
echo "$@" >> "${cargoLogPath}"
exit 0
`,
    );
    createFakeBin("cargo", binDir);
    createFakeBin("uname", binDir, `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo "Darwin"
elif [ "$1" = "-m" ]; then
  echo "arm64"
else
  echo "Darwin"
fi
`);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("`codex-acp` already installed; refreshing from the OmniHarness fork");
    expect(fs.readFileSync(cargoLogPath, "utf8")).toContain("run stable-aarch64-apple-darwin cargo install --locked --git https://github.com/danduma/codex-acp.git --branch main codex-acp");
  });
});
