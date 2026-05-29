import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, describe, expect, it } from "vitest";

function writeExecutable(filePath: string, contents: string) {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

describe("ensure-recommended-tools.sh", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips installation when rg is already available", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-tools-"));
    const binDir = path.join(tempDir, "bin");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    writeExecutable(path.join(binDir, "rg"), "#!/bin/sh\nexit 0\n");

    const result = spawnSync("/bin/bash", ["scripts/ensure-recommended-tools.sh"], {
      cwd: process.cwd(),
      env: { ...process.env, PATH: binDir },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ripgrep detected");
  });

  it("installs ripgrep with brew when rg is missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-tools-"));
    const binDir = path.join(tempDir, "bin");
    const logPath = path.join(tempDir, "brew.log");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });
    writeExecutable(path.join(binDir, "brew"), `#!/bin/sh
echo "$@" >> "${logPath}"
/bin/cat > "${path.join(binDir, "rg")}" <<'RG'
#!/bin/sh
exit 0
RG
/bin/chmod +x "${path.join(binDir, "rg")}"
exit 0
`);

    const result = spawnSync("/bin/bash", ["scripts/ensure-recommended-tools.sh"], {
      cwd: process.cwd(),
      env: { ...process.env, PATH: binDir },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(logPath, "utf8")).toContain("install ripgrep");
    expect(result.stdout).toContain("ripgrep installed");
  });

  it("continues when no supported installer is available", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-tools-"));
    const binDir = path.join(tempDir, "bin");
    tempDirs.push(tempDir);
    fs.mkdirSync(binDir, { recursive: true });

    const result = spawnSync("/bin/bash", ["scripts/ensure-recommended-tools.sh"], {
      cwd: process.cwd(),
      env: { ...process.env, PATH: binDir },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Could not install ripgrep automatically");
    expect(result.stdout).toContain("Continuing without it");
  });
});
