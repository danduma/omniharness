import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  NATIVE_CODEX_APPLICATION_CANDIDATES,
  buildManagedPath,
  createToolDiagnostics,
  resolveCommand,
  resolveCodexCommand,
  stripAmbientCodexSessionEnv,
  stripRunnerControlEnv,
  withCodexStandardTooling,
} from "@/server/agent-runtime/tool-env";

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
  it("does not pass the runner's live data root to agent processes", () => {
    expect(stripRunnerControlEnv({
      PATH: "/usr/bin",
      OMNIHARNESS_ROOT: "/srv/omniharness/live",
      OMNIHARNESS_INSTANCE: "production",
      OMNIHARNESS_BRIDGE_URL: "http://127.0.0.1:7800",
    })).toEqual({ PATH: "/usr/bin" });
  });

  it("does not leak the parent Codex session into nested agent CLIs", () => {
    expect(stripAmbientCodexSessionEnv({
      PATH: "/usr/bin",
      CODEX_HOME: "/runner/.omniharness/cli-home/codex/home",
      CODEX_SQLITE_HOME: "/runner/.omniharness/cli-home/codex/sqlite",
      CODEX_THREAD_ID: "outer-thread",
      CODEX_CI: "1",
      CODEX_MANAGED_CONFIG_PATH: "/tmp/runner-managed-config.toml",
      CODEX_MANAGED_PACKAGE_ROOT: "/runner/node_modules/@openai/codex",
      CODEX_PATH: "/runner/node_modules/.bin/codex",
      CODEX_MANAGED_BY_NPM: "1",
      CODEX_LOG_STDERR: "0",
      CUSTOM_WORKER_SETTING: "keep",
    })).toEqual({
      PATH: "/usr/bin",
      CUSTOM_WORKER_SETTING: "keep",
    });
  });

  it("preserves an explicitly configured Codex home without an ambient session marker", () => {
    expect(stripAmbientCodexSessionEnv({
      CODEX_HOME: "/configured/codex-home",
      CODEX_SQLITE_HOME: "/configured/codex-sqlite",
      CUSTOM_WORKER_SETTING: "keep",
    })).toEqual({
      CODEX_HOME: "/configured/codex-home",
      CODEX_SQLITE_HOME: "/configured/codex-sqlite",
      CUSTOM_WORKER_SETTING: "keep",
    });
  });

  it("finds the native Codex binary bundled with the ChatGPT app", () => {
    expect(NATIVE_CODEX_APPLICATION_CANDIDATES).toContain("/Applications/ChatGPT.app/Contents/Resources/codex");
  });

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

  it("keeps explicit PATH entries ahead of stale version-manager bin variables", () => {
    const home = createTempDir("omni-tool-env-home-");
    const pathBin = createTempDir("omni-tool-env-path-bin-");
    const staleNvmBin = createTempDir("omni-tool-env-nvm-bin-");
    createExecutable(pathBin, "gemini");
    createExecutable(staleNvmBin, "gemini");
    createExecutable(staleNvmBin, "nvm-only-tool");

    const managedEnv = {
      HOME: home,
      PATH: buildManagedPath({
        env: {
          HOME: home,
          PATH: pathBin,
          NVM_BIN: staleNvmBin,
          OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        },
      }),
    };

    expect(resolveCommand("gemini", { env: managedEnv })).toBe(join(pathBin, "gemini"));
    expect(resolveCommand("nvm-only-tool", { env: managedEnv })).toBe(join(staleNvmBin, "nvm-only-tool"));
  });

  it("prefers the managed Codex executable exported by the ACP launcher", () => {
    const staleBin = createTempDir("omni-tool-env-stale-codex-");
    const managedBin = createTempDir("omni-tool-env-managed-codex-");
    createExecutable(staleBin, "codex");
    createExecutable(managedBin, "codex");

    const managedCodex = join(managedBin, "codex");
    expect(resolveCodexCommand({
      env: {
        HOME: createTempDir("omni-tool-env-home-"),
        PATH: staleBin,
        CODEX_PATH: managedCodex,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      },
    })).toBe(managedCodex);
  });

  it("finds Codex in the managed ACP npm root before a stale PATH executable", () => {
    const staleBin = createTempDir("omni-tool-env-stale-codex-");
    const npmRoot = createTempDir("omni-tool-env-codex-root-");
    const managedBin = join(npmRoot, "node_modules", ".bin");
    const managedCodex = join(managedBin, "codex");
    mkdirSync(managedBin, { recursive: true });
    createExecutable(staleBin, "codex");
    createExecutable(managedBin, "codex");

    expect(resolveCodexCommand({
      env: {
        HOME: createTempDir("omni-tool-env-home-"),
        PATH: staleBin,
        OMNIHARNESS_CODEX_ACP_NPM_ROOT: npmRoot,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      },
    })).toBe(managedCodex);
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

  it("sanitizes current model metadata for a legacy Codex ACP runner", () => {
    const binDir = createTempDir("omni-tool-env-codex-bin-");
    const codexPath = join(binDir, "codex");
    const rawCatalog = JSON.stringify({
      models: [{
        slug: "gpt-5.6-sol",
        display_name: "GPT-5.6-Sol",
        supported_reasoning_levels: [
          { effort: "low", description: "Low" },
          { effort: "xhigh", description: "Extra high" },
          { effort: "max", description: "Maximum" },
          { effort: "ultra", description: "Automatic delegation" },
        ],
      }],
    });
    writeFileSync(
      codexPath,
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(rawCatalog)});\n`,
      { mode: 0o755 },
    );

    const env: Record<string, string | undefined> = withCodexStandardTooling({
      HOME: createTempDir("omni-tool-env-home-"),
      PATH: `${binDir}:${dirname(process.execPath)}`,
      OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
    });

    const managedConfig = readFileSync(env.CODEX_MANAGED_CONFIG_PATH || "", "utf8");
    const catalogPathLiteral = managedConfig.match(/^model_catalog_json = (".+")$/m)?.[1];
    expect(catalogPathLiteral).toBeDefined();
    const catalog = JSON.parse(readFileSync(JSON.parse(catalogPathLiteral || '""'), "utf8"));
    expect(catalog.models[0].slug).toBe("gpt-5.6-sol");
    expect(catalog.models[0].supported_reasoning_levels.map((level: { effort: string }) => level.effort)).toEqual([
      "low",
      "xhigh",
    ]);
    expect(catalog.models[0].supports_reasoning_summaries).toBe(true);
  });

  it("preserves every reasoning level for the maintained Codex ACP runner", () => {
    const binDir = createTempDir("omni-tool-env-current-acp-");
    const rawCatalog = JSON.stringify({
      models: [{
        slug: "gpt-5.6-sol",
        supported_reasoning_levels: [
          { effort: "low" },
          { effort: "xhigh" },
          { effort: "max" },
          { effort: "ultra" },
        ],
      }],
    });
    writeFileSync(join(binDir, "codex"), `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(rawCatalog)});\n`, { mode: 0o755 });
    writeFileSync(join(binDir, "codex-acp"), "#!/bin/sh\necho '@agentclientprotocol/codex-acp 1.1.7'\n", { mode: 0o755 });

    const env: Record<string, string | undefined> = withCodexStandardTooling({
      HOME: createTempDir("omni-tool-env-home-"),
      PATH: `${binDir}:${dirname(process.execPath)}`,
      OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
    });

    const managedConfig = readFileSync(env.CODEX_MANAGED_CONFIG_PATH || "", "utf8");
    const catalogPathLiteral = managedConfig.match(/^model_catalog_json = (".+")$/m)?.[1];
    const catalog = JSON.parse(readFileSync(JSON.parse(catalogPathLiteral || '""'), "utf8"));
    expect(catalog.models[0].supported_reasoning_levels.map((level: { effort: string }) => level.effort)).toEqual([
      "low",
      "xhigh",
      "max",
      "ultra",
    ]);
  });
});
