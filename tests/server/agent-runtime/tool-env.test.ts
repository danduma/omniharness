import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManagedPath, createToolDiagnostics, resolveCommand, withCodexStandardTooling } from "@/server/agent-runtime/tool-env";

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
    const codexNativeBinary = join(binDir, "codex-native");
    createExecutable(binDir, "codex-native");

    const diagnostics = createToolDiagnostics({
      env: {
        HOME: createTempDir("omni-tool-env-home-"),
        PATH: binDir,
        OMNIHARNESS_CODEX_NATIVE_BINARY: codexNativeBinary,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      },
    });

    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.structured.map((tool) => tool.name)).toEqual([
      "codex-core/exec_command",
      "codex-core/write_stdin",
      "codex-core/update_plan",
      "codex-core/apply_patch",
      "codex-core/web_search",
      "codex-core/view_image",
      "codex-core/list_mcp_resources",
      "codex-core/list_mcp_resource_templates",
      "codex-core/read_mcp_resource",
      "fs/read_text_file",
      "fs/write_text_file",
      "acp_fs/read_text_file",
      "acp_fs/write_text_file",
      "acp_fs/edit_text_file",
      "acp_fs/multi_edit_text_file",
    ]);
    expect(diagnostics.required.map((tool) => tool.name)).toEqual([
      "apply_patch",
      "applypatch",
      ...(process.platform === "linux" ? ["codex-linux-sandbox"] : []),
      "rg",
      "git",
      "node",
      "bash",
      "sh",
      "ls",
    ]);
    expect(diagnostics.required.every((tool) => tool.available)).toBe(true);
  });

  it("adds Codex argv0 shims ahead of worker PATH entries", () => {
    const binDir = createTempDir("omni-tool-env-bin-");
    const codexNativeBinary = join(binDir, "codex-native");
    writeFileSync(codexNativeBinary, "#!/bin/sh\necho argv0:${0##*/}\n", { mode: 0o755 });
    const env = {
      HOME: createTempDir("omni-tool-env-home-"),
      PATH: binDir,
      OMNIHARNESS_CODEX_NATIVE_BINARY: codexNativeBinary,
      OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
    };

    const managedEnv = {
      ...process.env,
      ...env,
      PATH: buildManagedPath({ env }),
    };
    const applyPatch = resolveCommand("apply_patch", { env: managedEnv });
    const applyPatchCompact = resolveCommand("applypatch", { env: managedEnv });

    expect(applyPatch).toMatch(/apply_patch$/);
    expect(applyPatchCompact).toMatch(/applypatch$/);
    expect(execFileSync("apply_patch", [], { env: managedEnv, encoding: "utf8" }).trim()).toBe("argv0:apply_patch");
    expect(execFileSync("applypatch", [], { env: managedEnv, encoding: "utf8" }).trim()).toBe("argv0:applypatch");
    if (process.platform === "linux") {
      const linuxSandbox = resolveCommand("codex-linux-sandbox", { env: managedEnv });
      expect(linuxSandbox).toMatch(/codex-linux-sandbox$/);
      expect(execFileSync("codex-linux-sandbox", [], { env: managedEnv, encoding: "utf8" }).trim()).toBe("argv0:codex-linux-sandbox");
    }
  });

  it("adds a Codex managed config that enables standard core tools", () => {
    const env: Record<string, string | undefined> = withCodexStandardTooling({
      HOME: createTempDir("omni-tool-env-home-"),
      PATH: "",
    });

    expect(env.CODEX_MANAGED_CONFIG_PATH).toMatch(/managed_config\.toml$/);
    const contents = readFileSync(env.CODEX_MANAGED_CONFIG_PATH || "", "utf8");
    expect(contents).toContain("web_search_request = true");
    expect(contents).toContain("apply_patch_freeform = true");
    expect(contents).toContain("unified_exec = true");
  });
});
