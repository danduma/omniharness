import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createToolDiagnostics } from "@/server/agent-runtime/tool-env";

const tempDirs: string[] = [];

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createExecutable(dir: string, name: string) {
  const filePath = join(dir, name);
  writeFileSync(filePath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("agent runtime tool environment diagnostics", () => {
  it("tracks the non-negotiable ACP filesystem and shell tool surface", () => {
    const binDir = createTempDir("omni-tool-env-bin-");
    for (const tool of ["rg", "git", "node", "bash", "sh", "ls"]) {
      createExecutable(binDir, tool);
    }

    const diagnostics = createToolDiagnostics({
      env: {
        HOME: createTempDir("omni-tool-env-home-"),
        PATH: binDir,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      },
    });

    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.structured.map((tool) => tool.name)).toEqual([
      "fs/read_text_file",
      "fs/write_text_file",
      "acp_fs/read_text_file",
      "acp_fs/write_text_file",
      "acp_fs/edit_text_file",
      "acp_fs/multi_edit_text_file",
    ]);
    expect(diagnostics.required.map((tool) => tool.name)).toEqual(["rg", "git", "node", "bash", "sh", "ls"]);
    expect(diagnostics.required.every((tool) => tool.available)).toBe(true);
  });
});
