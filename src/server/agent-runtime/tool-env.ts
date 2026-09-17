import { execFile, execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  accessSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  loginShellPathMode?: "blocking" | "cached";
};

type CommandLookupInput = {
  env?: EnvLike;
  cwd?: string;
};

const CODEX_ARGV0_TOOL_NAMES = platform() === "linux"
  ? ["apply_patch", "applypatch", "codex-linux-sandbox"]
  : ["apply_patch", "applypatch"];
export const NATIVE_CODEX_APPLICATION_CANDIDATES = [
  "/Applications/Codex.app/Contents/Resources/codex",
  "/Applications/ChatGPT.app/Contents/Resources/codex",
] as const;
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
const loginShellPathCache = new Map<string, { path: string | null; refreshing: boolean }>();
const RUNNER_CONTROL_ENV_KEYS = [
  "OMNIHARNESS_ROOT",
  "OMNIHARNESS_INSTANCE",
  "OMNIHARNESS_BRIDGE_URL",
  "OMNIHARNESS_AGENT_RUNTIME_HOST",
  "OMNIHARNESS_AGENT_RUNTIME_PORT",
  "OMNIHARNESS_RUNNER_HOST",
  "OMNIHARNESS_RUNNER_PORT",
  "OMNIHARNESS_STATIC_DIR",
] as const;
const CODEX_SESSION_ENV_MARKER_KEYS = [
  "CODEX_THREAD_ID",
  "CODEX_CI",
  "CODEX_MANAGED_CONFIG_PATH",
  "CODEX_MANAGED_PACKAGE_ROOT",
  "CODEX_MANAGED_BY_NPM",
] as const;

const CODEX_STANDARD_TOOL_CONFIG = `[features]
apply_patch_freeform = true
unified_exec = true
web_search_request = true
view_image_tool = true
shell_tool = true
parallel = true
remote_models = true
`;
const LEGACY_CODEX_ACP_REASONING_EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);

type CodexModelCatalog = {
  models: Array<Record<string, unknown>>;
};

function parseStableCodexVersion(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/(?:rust-v|^)(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
}

function codexAcpSupportsCurrentCatalog(env: EnvLike) {
  const codexAcpPath = resolveCommand("codex-acp", { env });
  if (!codexAcpPath) {
    return false;
  }

  try {
    const build = JSON.parse(readFileSync(`${codexAcpPath}.build.json`, "utf8")) as { codex_ref?: unknown };
    return (parseStableCodexVersion(build.codex_ref) ?? 0) >= parseStableCodexVersion("rust-v0.144.0")!;
  } catch {
    try {
      const version = execFileSync(codexAcpPath, ["--version"], {
        env: env as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 3_000,
      });
      return version.includes("@agentclientprotocol/codex-acp");
    } catch {
      return false;
    }
  }
}

function prepareCodexModelCatalogForAcp(rawCatalog: string, supportsCurrentCatalog: boolean): CodexModelCatalog {
  const parsed = JSON.parse(rawCatalog) as Partial<CodexModelCatalog>;
  if (!Array.isArray(parsed.models) || parsed.models.length === 0) {
    throw new Error("Codex returned an empty model catalog");
  }

  if (supportsCurrentCatalog) {
    return { models: parsed.models };
  }

  return {
    models: parsed.models.map((model) => {
      const supportedReasoningLevels = Array.isArray(model.supported_reasoning_levels)
        ? model.supported_reasoning_levels.filter((level) => (
          typeof level === "object"
          && level !== null
          && LEGACY_CODEX_ACP_REASONING_EFFORTS.has(String((level as { effort?: unknown }).effort ?? ""))
        ))
        : [];
      const defaultReasoningLevel = LEGACY_CODEX_ACP_REASONING_EFFORTS.has(String(model.default_reasoning_level ?? ""))
        ? model.default_reasoning_level
        : supportedReasoningLevels.at(-1) && typeof supportedReasoningLevels.at(-1) === "object"
          ? (supportedReasoningLevels.at(-1) as { effort?: unknown }).effort
          : undefined;

      return {
        ...model,
        supported_reasoning_levels: supportedReasoningLevels,
        ...(defaultReasoningLevel ? { default_reasoning_level: defaultReasoningLevel } : {}),
        supports_reasoning_summaries: typeof model.supports_reasoning_summaries === "boolean"
          ? model.supports_reasoning_summaries
          : supportedReasoningLevels.length > 0,
      };
    }),
  };
}

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
  let fd: number | null = null;
  try {
    fd = openSync(filePath, "r");
    const buffer = Buffer.alloc(256);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").includes("/usr/bin/env node");
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}

function nativeCodexCandidates(env: EnvLike): string[] {
  const triple = codexTargetTriple();
  const binaryName = platform() === "win32" ? "codex.exe" : "codex";
  const explicit = env.OMNIHARNESS_CODEX_NATIVE_BINARY || env.CODEX_NATIVE_BINARY;
  const candidates = [
    explicit,
    ...NATIVE_CODEX_APPLICATION_CANDIDATES,
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

  const codexCommand = resolveCodexCommand({ env });
  const cacheKey = [
    env.CODEX_MANAGED_CONFIG_PATH || "omniharness-default",
    env.HOME || homedir(),
    env.CODEX_HOME || "",
    codexCommand || "",
  ].join("\0");
  const existing = codexManagedConfigPaths.get(cacheKey);
  if (existing && existsSync(existing)) {
    return existing;
  }

  try {
    const dir = mkdtempSync(join(tmpdir(), "omniharness-codex-config-"));
    const configPath = join(dir, "managed_config.toml");
    let modelCatalogConfig = "";
    if (codexCommand) {
      try {
        const commandEnv = { ...env };
        delete commandEnv.CODEX_MANAGED_CONFIG_PATH;
        const rawCatalog = execFileSync(codexCommand, ["debug", "models"], {
          env: commandEnv as NodeJS.ProcessEnv,
          encoding: "utf8",
          timeout: 10_000,
          maxBuffer: 8 * 1024 * 1024,
        });
        const catalog = prepareCodexModelCatalogForAcp(rawCatalog, codexAcpSupportsCurrentCatalog(env));
        const catalogPath = join(dir, "model_catalog.json");
        writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`, "utf8");
        modelCatalogConfig = `model_catalog_json = ${JSON.stringify(catalogPath)}\n\n`;
      } catch (error) {
        console.warn("OmniHarness could not load current Codex model details for the ACP runner.", error);
      }
    }
    writeFileSync(configPath, `${modelCatalogConfig}${CODEX_STANDARD_TOOL_CONFIG}`, "utf8");
    codexManagedConfigPaths.set(cacheKey, configPath);
    return configPath;
  } catch {
    return null;
  }
}

function loginShellPathCacheKey(env: EnvLike, shell: string) {
  return [
    shell,
    env.HOME || homedir(),
    env.USER || "",
    env.LOGNAME || "",
  ].join("\0");
}

function readLoginShellPathBlocking(shell: string, env: EnvLike): string | null {
  try {
    return execFileSync(shell, ["-l", "-c", "printf %s \"$PATH\""], {
      env: env as NodeJS.ProcessEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function refreshLoginShellPath(cacheKey: string, shell: string, env: EnvLike) {
  const cached = loginShellPathCache.get(cacheKey);
  if (cached?.refreshing) {
    return;
  }

  loginShellPathCache.set(cacheKey, { path: cached?.path ?? null, refreshing: true });
  const child = execFile(shell, ["-l", "-c", "printf %s \"$PATH\""], {
    env: env as NodeJS.ProcessEnv,
    encoding: "utf8",
  }, (error, stdout) => {
    loginShellPathCache.set(cacheKey, {
      path: error ? cached?.path ?? null : stdout.trim(),
      refreshing: false,
    });
  });
  child.unref?.();
}

function getLoginShell(env: EnvLike): string | null {
  if (env.OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH === "1") {
    return null;
  }

  const shell = env.SHELL?.trim();
  if (!shell || !existsSync(shell)) {
    return null;
  }

  return shell;
}

export async function refreshCachedLoginShellPath(env: EnvLike): Promise<void> {
  const shell = getLoginShell(env);
  if (!shell) {
    return;
  }

  const cacheKey = loginShellPathCacheKey(env, shell);
  const cached = loginShellPathCache.get(cacheKey);
  if (cached?.refreshing) {
    return;
  }

  loginShellPathCache.set(cacheKey, { path: cached?.path ?? null, refreshing: true });
  const path = readLoginShellPathBlocking(shell, env);
  loginShellPathCache.set(cacheKey, { path, refreshing: false });
}

function readLoginShellPath(env: EnvLike, mode: "blocking" | "cached"): string | null {
  const shell = getLoginShell(env);
  if (!shell) {
    return null;
  }

  const cacheKey = loginShellPathCacheKey(env, shell);
  if (mode === "blocking") {
    const cached = loginShellPathCache.get(cacheKey);
    if (cached && !cached.refreshing) {
      return cached.path;
    }
    const path = readLoginShellPathBlocking(shell, env);
    loginShellPathCache.set(cacheKey, { path, refreshing: false });
    return path;
  }

  const cached = loginShellPathCache.get(cacheKey);
  refreshLoginShellPath(cacheKey, shell, env);
  return cached?.path ?? null;
}

export function buildManagedPath(input: BuildManagedPathInput = {}): string {
  const env = input.env || process.env;
  const home = env.HOME || homedir();
  const inherited = splitPath(env.PATH);
  const loginPath = input.loginShellPathProvider
    ? input.loginShellPathProvider(env)
    : readLoginShellPath(env, input.loginShellPathMode ?? "blocking");

  return mergePathEntries([
    createCodexArgv0ShimDir(env),
    ...projectBinDirs(input.cwd, home),
    ...inherited,
    ...splitPath(loginPath || undefined),
    ...envBinDirs(env, home),
    ...systemBinDirs(),
  ]);
}

export function withManagedPath<T extends EnvLike>(env: T, cwd?: string, options: { loginShellPathMode?: "blocking" | "cached" } = {}): T {
  return {
    ...env,
    PATH: buildManagedPath({ cwd, env, loginShellPathMode: options.loginShellPathMode }),
  };
}

export function stripRunnerControlEnv<T extends EnvLike>(env: T): T {
  const sanitized = { ...env };
  for (const key of RUNNER_CONTROL_ENV_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

/**
 * A worker may itself be launched from inside Codex (for example, a Claude
 * worker running `codex exec` for a second opinion). Codex exports session
 * identity, storage, and launcher variables into its child process. Passing
 * those through would make the nested CLI attach to or contend with the
 * parent session instead of starting an independent invocation.
 *
 * Only an environment that carries a Codex session marker is treated as
 * ambient. This preserves deliberately configured CODEX_HOME values in a
 * normal server environment; worker-specific env overrides are merged after
 * this boundary is applied.
 */
export function stripAmbientCodexSessionEnv<T extends EnvLike>(env: T): T {
  const hasSessionMarker = CODEX_SESSION_ENV_MARKER_KEYS.some((key) => Boolean(env[key]?.trim()));
  if (!hasSessionMarker) {
    return { ...env };
  }

  const sanitized = { ...env };
  for (const key of Object.keys(sanitized)) {
    if (key.startsWith("CODEX_")) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export function withCodexStandardTooling<T extends EnvLike>(env: T): T {
  const managedConfigPath = createCodexManagedToolConfigPath(env);
  return {
    ...env,
    ...(managedConfigPath ? { CODEX_MANAGED_CONFIG_PATH: managedConfigPath } : {}),
  };
}

function codexManagedExecutableCandidates(env: EnvLike): string[] {
  const packageRoot = env.CODEX_MANAGED_PACKAGE_ROOT?.trim();
  const defaultNpmRoot = platform() === "win32"
    ? join(env.LOCALAPPDATA || join(env.HOME || homedir(), ".omniharness"), "codex-acp")
    : join(env.HOME || homedir(), ".local", "share", "omniharness", "codex-acp");
  const codexLauncherName = platform() === "win32" ? "codex.cmd" : "codex";
  const npmRoots = [
    env.OMNIHARNESS_CODEX_ACP_NPM_ROOT?.trim(),
    defaultNpmRoot,
  ].filter((root): root is string => Boolean(root));
  const candidates = [
    env.CODEX_PATH?.trim(),
    packageRoot ? join(packageRoot, "bin", "codex.js") : undefined,
    packageRoot ? join(dirname(dirname(packageRoot)), "node_modules", ".bin", codexLauncherName) : undefined,
    ...npmRoots.flatMap((root) => [
      join(root, "node_modules", ".bin", codexLauncherName),
      join(root, "node_modules", "@openai", "codex", "bin", "codex.js"),
    ]),
  ];

  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
}

export function resolveCodexCommand(input: CommandLookupInput = {}): string | null {
  const env = input.env || process.env;

  for (const candidate of codexManagedExecutableCandidates(env)) {
    const resolved = resolveCommand(candidate, input);
    if (resolved) {
      return resolved;
    }
  }

  const managedEnv = withManagedPath(env, input.cwd, { loginShellPathMode: "cached" });
  return resolveCommand("codex", { ...input, env: managedEnv });
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
  assumeManagedPath?: boolean;
} = {}): ToolDiagnostics {
  const managedEnv = input.assumeManagedPath
    ? input.env || process.env
    : withManagedPath(input.env || process.env, input.cwd);
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
