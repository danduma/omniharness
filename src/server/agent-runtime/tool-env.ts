import { execFileSync } from "node:child_process";
import { constants, accessSync, existsSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, parse } from "node:path";
import { homedir } from "node:os";

export type EnvLike = Record<string, string | undefined>;

export type ToolDiagnostic = {
  name: string;
  available: boolean;
  path: string | null;
  required: boolean;
};

export type ToolDiagnostics = {
  ok: boolean;
  path: string;
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

const DEFAULT_REQUIRED_TOOLS = [
  "rg",
  "git",
  "node",
  "bash",
  "sh",
  "sed",
  "awk",
  "grep",
  "find",
  "xargs",
  "cat",
  "ls",
  "mkdir",
  "rm",
  "cp",
  "mv",
];
const DEFAULT_OPTIONAL_TOOLS = [
  "pnpm",
  "npm",
  "python3",
  "python",
  "zsh",
  "jq",
  "gh",
  "cargo",
  "uv",
  "fd",
  "make",
];

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
} = {}): ToolDiagnostics {
  const managedEnv = withManagedPath(input.env || process.env, input.cwd);
  const required = input.required || DEFAULT_REQUIRED_TOOLS;
  const optional = input.optional || DEFAULT_OPTIONAL_TOOLS;

  const toDiagnostic = (name: string, requiredTool: boolean): ToolDiagnostic => {
    const foundPath = resolveCommand(name, { env: managedEnv, cwd: input.cwd });
    return {
      name,
      available: Boolean(foundPath),
      path: foundPath,
      required: requiredTool,
    };
  };

  const requiredDiagnostics = required.map((name) => toDiagnostic(name, true));
  const optionalDiagnostics = optional.map((name) => toDiagnostic(name, false));

  return {
    ok: requiredDiagnostics.every((item) => item.available),
    path: managedEnv.PATH || "",
    required: requiredDiagnostics,
    optional: optionalDiagnostics,
  };
}
