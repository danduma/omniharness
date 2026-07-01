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

describe("install-restarter.sh", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("installs a boot-time launchd daemon by default", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-restarter-"));
    const binDir = path.join(tempDir, "bin");
    const launchdDir = path.join(tempDir, "Library", "LaunchDaemons");
    const launchAgentDir = path.join(tempDir, "Library", "LaunchAgents");
    const launchctlLog = path.join(tempDir, "launchctl.log");
    const stateFile = path.join(tempDir, "launchctl.state");
    tempDirs.push(tempDir);

    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(launchdDir, { recursive: true });
    fs.mkdirSync(launchAgentDir, { recursive: true });
    fs.writeFileSync(path.join(launchAgentDir, "com.omniharness.restart-control.plist"), "legacy", "utf8");

    createFakeBin("pnpm", binDir);
    createFakeBin("node", binDir);
    createFakeBin("id", binDir, `#!/bin/sh
if [ "$1" = "-un" ]; then
  echo "fakeuser"
  exit 0
fi
if [ "$1" = "-u" ] && [ "\${2:-}" = "fakeuser" ]; then
  echo "4242"
  exit 0
fi
/usr/bin/id "$@"
`);
    createFakeBin("launchctl", binDir, `#!/bin/sh
echo "$@" >> "${launchctlLog}"
case "$1" in
  print)
    if [ -f "${stateFile}" ]; then
      echo "state = running"
      exit 0
    fi
    exit 1
    ;;
  bootstrap)
    : > "${stateFile}"
    exit 0
    ;;
  bootout)
    rm -f "${stateFile}"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`);

    const result = spawnSync("/bin/bash", ["scripts/install-restarter.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: tempDir,
        PATH: `${binDir}:/usr/bin:/bin`,
        SUDO_USER: "fakeuser",
        OMNIHARNESS_REMOTE_RESTART_PORT: "4123",
        OMNIHARNESS_RESTART_LAUNCHD_DIR: launchdDir,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const plistPath = path.join(launchdDir, "com.omniharness.restart-control.plist");
    const plist = fs.readFileSync(plistPath, "utf8");
    expect(plist).toContain("<key>UserName</key>");
    expect(plist).toContain("<string>fakeuser</string>");
    expect(plist).toContain(`<string>${tempDir}</string>`);
    expect(plist).toContain("restart:control");
    expect(fs.existsSync(path.join(launchAgentDir, "com.omniharness.restart-control.plist"))).toBe(false);
    expect(fs.readFileSync(launchctlLog, "utf8")).toContain("bootstrap system");
    expect(fs.readFileSync(launchctlLog, "utf8")).toContain("print system/com.omniharness.restart-control");
    expect(result.stdout).toContain("restart-control listening on http://0.0.0.0:4123");
  });
});
