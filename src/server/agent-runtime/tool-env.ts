import { execFileSync } from "node:child_process";
import { constants, accessSync, existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, parse } from "node:path";
import { arch, homedir, platform, tmpdir } from "node:os";

export type EnvLike = Record<string, string | undefined>;

export type ToolDiagnostic = {
  name: string;
  available: boolean;
  path: string | null;
  required: boolean;
};

export type StructuredToolDiagnostic = {
  name: string;
  available: boolean;
  provider: string;
  required: boolean;
};

export type ToolDiagnostics = {
  ok: boolean;
  path: string;
  structured: StructuredToolDiagnostic[];
  required: ToolDiagnostic[];
  optional: ToolDiagnostic[];
};

function executableExists(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

type BuildManagedPathInput = {
  cwd?: string;
  env?: EnvLike;
  loginShellPathProvider?: (env: EnvLike) => string | null | undefined;
};

type CommandLookupInput = {
  env?: EnvLike;
  cwd?: string;
};

const CODEX_ARGV0_TOOL_NAMES = platform() === "linux"
  ? ["apply_patch", "applypatch", "codex-linux-sandbox"]
  : ["apply_patch", "applypatch"];
const DEFAULT_REQUIRED_TOOLS = [
  "apply_patch",
  "applypatch",
  ...(platform() === "linux" ? ["codex-linux-sandbox"] : []),
  "rg",
  "git",
  "node",
  "bash",
  "sh",
  "ls",
];
const DEFAULT_OPTIONAL_TOOLS = [
  "pnpm",
  "npm",
  "python3",
  "python",
  "zsh",
  "sed",
  "awk",
  "grep",
  "find",
  "xargs",
  "mkdir",
  "rm",
  "cp",
  "mv",
  "jq",
  "gh",
  "cargo",
  "uv",
  "fd",
  "make",
];
const DEFAULT_STRUCTURED_TOOLS = [
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
];

const codexArgv0ShimDirs = new Map<string, string>();
const codexManagedConfigPaths = new Map<string, string>();

const CODEX_STANDARD_TOOL_CONFIG = `[features]
apply_patch_freeform = true
unified_exec = true
web_search_request = true
view_image_tool = true
shell_tool = true
parallel = true
remote_models = true
`;

function splitPath(value: string | undefined): string[] {
  return (value || "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function mergePathEntries(entries: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    merged.push(entry);
  }

  return merged.join(delimiter);
}

function existingParentDirs(cwd: string | undefined, stopAt: string): string[] {
  if (!cwd || !isAbsolute(cwd)) {
    return [];
  }

  const dirs: string[] = [];
  let current = cwd;
  const root = parse(cwd).root;
  const stop = stopAt || root;

  while (current && current !== root) {
    dirs.push(current);
    if (current === stop) {
      break;
    }
    const next = dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return dirs;
}

function projectBinDirs(cwd: string | undefined, home: string): string[] {
  return existingParentDirs(cwd, home)
    .map((dir) => join(dir, "node_modules", ".bin"));
}

function envBinDirs(env: EnvLike, home: string): string[] {
  const dirs = [
    env.NVM_BIN,
    env.PNPM_HOME,
    env.BUN_INSTALL ? join(env.BUN_INSTALL, "bin") : undefined,
    env.CARGO_HOME ? join(env.CARGO_HOME, "bin") : undefined,
    env.PYENV_ROOT ? join(env.PYENV_ROOT, "shims") : undefined,
    join(home, ".cargo", "bin"),
    join(home, ".local", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".deno", "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".yarn", "bin"),
    join(home, ".opencode", "bin"),
    join(home, ".pyenv", "shims"),
  ];

  return dirs.filter((entry): entry is string => Boolean(entry));
}

function systemBinDirs(): string[] {
  return [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/opt/local/bin",
    "/opt/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
}

function codexTargetTriple() {
  if (platform() === "darwin") {
    return arch() === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  if (platform() === "linux") {
    return arch() === "arm64" ? "aarch64-unknown-linux-musl" : "x86_64-unknown-linux-musl";
  }
  if (platform() === "win32") {
    return arch() === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
  }
  return null;
}

function isProbablyNodeLauncher(filePath: string) {
  try {
    return readFileSync(filePath, "utf8").slice(0, 256).includes("/usr/bin/env node");
  } catch {
    return false;
  }
}

function nativeCodexCandidates(env: EnvLike): string[] {
  const triple = codexTargetTriple();
  const binaryName = platform() === "win32" ? "codex.exe" : "codex";
  const explicit = env.OMNIHARNESS_CODEX_NATIVE_BINARY || env.CODEX_NATIVE_BINARY;
  const candidates = [
    explicit,
    "/Applications/Codex.app/Contents/Resources/codex",
  ];

  const codexCommand = resolveCommand("codex", { env });
  if (codexCommand) {
    candidates.push(codexCommand);

    if (triple) {
      const commandDir = dirname(codexCommand);
      const nodePrefix = dirname(commandDir);
      const possiblePackageRoots = [join(nodePrefix, "lib", "node_modules", "@openai", "codex")];
      const normalizedCommand = codexCommand.replace(/\\/g, "/");
      const packageBinSegment = "/node_modules/@openai/codex/bin/";
      if (normalizedCommand.includes(packageBinSegment)) {
        possiblePackageRoots.push(dirname(dirname(codexCommand)));
      }

      for (const packageRoot of possiblePackageRoots) {
        candidates.push(
          join(packageRoot, "node_modules", `@openai/codex-${platform() === "darwin" ? "darwin" : platform()}-${arch() === "arm64" ? "arm64" : "x64"}`, "vendor", triple, "codex", binaryName),
          join(packageRoot, "vendor", triple, "codex", binaryName),
        );
      }
    }
  }

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

function resolveNativeCodexBinary(env: EnvLike): string | null {
  for (const candidate of nativeCodexCandidates(env)) {
    if (!executableExists(candidate)) {
      continue;
    }
    if (isProbablyNodeLauncher(candidate)) {
      continue;
    }
    return candidate;
  }
  return null;
}

function createCodexArgv0ShimDir(env: EnvLike): string | null {
  const nativeCodexBinary = resolveNativeCodexBinary(env);
  if (!nativeCodexBinary) {
    return null;
  }

  const existing = codexArgv0ShimDirs.get(nativeCodexBinary);
  if (existing && CODEX_ARGV0_TOOL_NAMES.every((tool) => executableExists(join(existing, tool)))) {
    return existing;
  }

  try {
    const dir = mkdtempSync(join(tmpdir(), "omniharness-codex-tools-"));
    for (const tool of CODEX_ARGV0_TOOL_NAMES) {
      symlinkSync(nativeCodexBinary, join(dir, tool));
    }
    codexArgv0ShimDirs.set(nativeCodexBinary, dir);
    return dir;
  } catch {
    return null;
  }
}

export function createCodexManagedToolConfigPath(env: EnvLike = process.env): string | null {
  if (env.OMNIHARNESS_DISABLE_CODEX_MANAGED_TOOL_CONFIG === "1") {
    return null;
  }

  const cacheKey = env.CODEX_MANAGED_CONFIG_PATH || "omniharness-default";
  const existing = codexManagedConfigPaths.get(cacheKey);
  if (existing && existsSync(existing)) {
    return existing;
  }

  try {
    const dir = mkdtempSync(join(tmpdir(), "omniharness-codex-config-"));
    const configPath = join(dir, "managed_config.toml");
    writeFileSync(configPath, CODEX_STANDARD_TOOL_CONFIG, "utf8");
    codexManagedConfigPaths.set(cacheKey, configPath);
    return configPath;
  } catch {
    return null;
  }
}

function readLoginShellPath(env: EnvLike): string | null {
  if (env.OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH === "1" || env.ACP_BRIDGE_DISABLE_LOGIN_PATH === "1") {
    return null;
  }

  const shell = env.SHELL?.trim();
  if (!shell || !existsSync(shell)) {
    return null;
  }

  try {
    return execFileSync(shell, ["-l", "-c", "printf %s \"$PATH\""], {
      env: env as NodeJS.ProcessEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
  } catch {
    return null;
  }
}

export function buildManagedPath(input: BuildManagedPathInput = {}): string {
  const env = input.env || process.env;
  const home = env.HOME || homedir();
  const inherited = splitPath(env.PATH);
  const loginPath = input.loginShellPathProvider
    ? input.loginShellPathProvider(env)
    : readLoginShellPath(env);

  return mergePathEntries([
    createCodexArgv0ShimDir(env),
    ...projectBinDirs(input.cwd, home),
    ...envBinDirs(env, home),
    ...inherited,
    ...splitPath(loginPath || undefined),
    ...systemBinDirs(),
  ]);
}

export function withManagedPath<T extends EnvLike>(env: T, cwd?: string): T {
  return {
    ...env,
    PATH: buildManagedPath({ cwd, env }),
  };
}

export function withCodexStandardTooling<T extends EnvLike>(env: T): T {
  const managedConfigPath = createCodexManagedToolConfigPath(env);
  return {
    ...env,
    ...(managedConfigPath ? { CODEX_MANAGED_CONFIG_PATH: managedConfigPath } : {}),
  };
}

export function resolveCommand(command: string, input: CommandLookupInput = {}): string | null {
  const env = input.env || process.env;
  const expanded = command.startsWith("~/")
    ? join(env.HOME || homedir(), command.slice(2))
    : command;

  if (expanded.includes("/")) {
    return executableExists(expanded) ? expanded : null;
  }

  const pathEntries = splitPath(env.PATH);
  for (const dir of pathEntries) {
    const candidate = join(dir, expanded);
    if (executableExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function commandAvailable(command: string, input: CommandLookupInput = {}): boolean {
  return Boolean(resolveCommand(command, input));
}

export function createToolDiagnostics(input: {
  env?: EnvLike;
  cwd?: string;
  required?: string[];
  optional?: string[];
  structured?: string[];
} = {}): ToolDiagnostics {
  const managedEnv = withManagedPath(input.env || process.env, input.cwd);
  const required = input.required || DEFAULT_REQUIRED_TOOLS;
  const optional = input.optional || DEFAULT_OPTIONAL_TOOLS;
  const structured = input.structured || DEFAULT_STRUCTURED_TOOLS;

  const toDiagnostic = (name: string, requiredTool: boolean): ToolDiagnostic => {
    const foundPath = resolveCommand(name, { env: managedEnv, cwd: input.cwd });
    return {
      name,
      available: Boolean(foundPath),
      path: foundPath,
      required: requiredTool,
    };
  };

  const structuredDiagnostics = structured.map((name) => ({
    name,
    available: true,
    provider: name.startsWith("codex-core/")
      ? "Codex core managed config"
      : name.startsWith("fs/") ? "ACP client filesystem" : "codex-acp acp_fs",
    required: true,
  }));
  const requiredDiagnostics = required.map((name) => toDiagnostic(name, true));
  const optionalDiagnostics = optional.map((name) => toDiagnostic(name, false));

  return {
    ok: structuredDiagnostics.every((item) => item.available) && requiredDiagnostics.every((item) => item.available),
    path: managedEnv.PATH || "",
    structured: structuredDiagnostics,
    required: requiredDiagnostics,
    optional: optionalDiagnostics,
  };
}
