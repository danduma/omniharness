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
    expect(result.stdout).toContain("would install prebuilt `codex-acp` from `https://github.com/danduma/omniharness/releases/download/codex-acp-latest/codex-acp-darwin-arm64`");
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

  it("installs a prebuilt Codex ACP adapter and the Claude ACP adapter when their CLIs are present", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    const npmLogPath = path.join(tempDir, "npm.log");
    const curlLogPath = path.join(tempDir, "curl.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

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
    createFakeBin("curl", binDir, `#!/bin/sh
echo "$@" >> "${curlLogPath}"
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    out="$1"
  fi
  shift
done
printf '#!/bin/sh\\nexit 0\\n' > "$out"
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

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(curlLogPath, "utf8")).toContain("codex-acp-darwin-arm64");
    expect(fs.existsSync(path.join(homeDir, ".local", "bin", "codex-acp"))).toBe(true);
    expect(result.stdout).toContain("installed prebuilt `codex-acp`");
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

  it("refreshes an existing Codex ACP adapter from the prebuilt release", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    const curlLogPath = path.join(tempDir, "curl.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("codex-acp", binDir);
    createFakeBin("curl", binDir, `#!/bin/sh
echo "$@" >> "${curlLogPath}"
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    out="$1"
  fi
  shift
done
printf '#!/bin/sh\\nexit 0\\n' > "$out"
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

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("`codex-acp` already installed; refreshing from the prebuilt release");
    expect(fs.readFileSync(curlLogPath, "utf8")).toContain("codex-acp-darwin-arm64");
  });

  it("can install Codex ACP from Cargo when Cargo mode is explicit", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const cargoLogPath = path.join(tempDir, "cargo.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    createFakeBin("codex", binDir);
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

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--codex-acp=cargo"], {
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
  });

  it("installs a Docker-backed Codex ACP wrapper without requiring host Rust", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    const dockerLogPath = path.join(tempDir, "docker.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("docker", binDir, `#!/bin/sh
echo "$@" >> "${dockerLogPath}"
if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then
  exit 1
fi
exit 0
`);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--codex-acp=docker"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    const wrapperPath = path.join(homeDir, ".local", "bin", "codex-acp");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("installed Docker-backed `codex-acp` wrapper");
    const dockerLog = fs.readFileSync(dockerLogPath, "utf8");
    expect(dockerLog).toContain("build -t omniharness/codex-acp:local");
    expect(dockerLog).toContain("docker/codex-acp/Dockerfile");
    expect(fs.existsSync(wrapperPath)).toBe(true);
    const wrapper = fs.readFileSync(wrapperPath, "utf8");
    expect(wrapper).toContain("args=(run --rm -i)");
    expect(wrapper).toContain('exec "$DOCKER_BIN"');
    expect(wrapper).toContain("omniharness/codex-acp:local");
    expect(wrapper).toContain("CODEX_HOME");
  });

  it("uses the prebuilt Codex ACP installer in auto mode when Rust is missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("docker", binDir);
    createFakeBin("uname", binDir, `#!/bin/sh
if [ "$1" = "-s" ]; then
  echo "Linux"
elif [ "$1" = "-m" ]; then
  echo "x86_64"
else
  echo "Linux"
fi
`);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would install prebuilt `codex-acp` from `https://github.com/danduma/omniharness/releases/download/codex-acp-latest/codex-acp-linux-x64`");
    expect(result.stdout).not.toContain("cargo install --locked");
  });

  it("refreshes the Docker-backed wrapper in ensure-only mode when Docker mode is explicit", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("codex-acp", binDir);
    createFakeBin("docker", binDir);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--ensure-only", "--dry-run", "--codex-acp=docker"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("refreshing Docker-backed `codex-acp` wrapper");
    expect(result.stdout).toContain("would install Docker-backed `codex-acp` wrapper");
  });

  it("uses Podman as the container runtime when Docker is absent", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-acp-"));
    const binDir = path.join(tempDir, "bin");
    const homeDir = path.join(tempDir, "home");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });

    createFakeBin("codex", binDir);
    createFakeBin("podman", binDir);

    const result = spawnSync("/bin/bash", ["scripts/install-agent-acp.sh", "--dry-run", "--codex-acp=docker"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would build missing image with `podman build");
  });
});
