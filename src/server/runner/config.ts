import path from "node:path";

type EnvLike = Record<string, string | undefined>;

export interface RunnerConfig {
  host: string;
  port: number;
  bridgeUrl: string;
  manageBridge: boolean;
  repositoryRoot: string;
  instanceRoot: string;
  databasePath: string;
  bridgeLockPath: string;
  runnerLockPath: string;
  staticDir: string | null;
  staticDirExplicit: boolean;
  staticDisabled: boolean;
  interfaceDevUrl: string | null;
}

export interface ResolveRunnerConfigOptions {
  argv: string[];
  cwd: string;
  env: EnvLike;
}

function readPort(raw: string | undefined, label: string, fallback: number) {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new TypeError(`${label} must be an integer from 0 to 65535.`);
  }
  return value;
}

function readArgs(argv: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--no-static") {
      flags.add(flag);
      continue;
    }
    if (!["--port", "--host", "--bridge-url", "--static-dir", "--interface-dev-url"].includes(flag)) {
      throw new TypeError(`Unknown server option: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError(`${flag} requires a value.`);
    }
    values.set(flag, value);
    index += 1;
  }
  return { values, flags };
}

function normalizeInstanceName(value: string | undefined) {
  const instance = value?.trim() ?? "";
  if (!instance) {
    return null;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(instance)) {
    throw new TypeError(
      "OMNIHARNESS_INSTANCE must contain only letters, digits, dots, underscores, or dashes.",
    );
  }
  return instance;
}

export function resolveRunnerConfig({
  argv,
  cwd,
  env,
}: ResolveRunnerConfigOptions): RunnerConfig {
  const { values: args, flags } = readArgs(argv);
  const repositoryRoot = path.resolve(cwd);
  const configuredRoot = env.OMNIHARNESS_ROOT?.trim();
  const baseRoot = path.resolve(configuredRoot || repositoryRoot);
  const instance = normalizeInstanceName(env.OMNIHARNESS_INSTANCE);
  const instanceRoot = instance
    ? path.join(baseRoot, "instances", instance)
    : baseRoot;
  const bridgeUrl = args.get("--bridge-url")
    ?? env.OMNIHARNESS_BRIDGE_URL?.trim()
    ?? "http://127.0.0.1:7800";
  try {
    new URL(bridgeUrl);
  } catch {
    throw new TypeError("--bridge-url must be a valid URL.");
  }

  const explicitStaticDir = args.get("--static-dir")
    ?? env.OMNIHARNESS_STATIC_DIR?.trim()
    ?? null;
  const staticDisabled = flags.has("--no-static")
    || ["1", "true"].includes(env.OMNIHARNESS_NO_STATIC?.trim().toLowerCase() ?? "");
  if (staticDisabled && explicitStaticDir) {
    throw new TypeError("--no-static cannot be combined with --static-dir.");
  }

  const interfaceDevUrl = args.get("--interface-dev-url")
    ?? env.OMNIHARNESS_INTERFACE_DEV_URL?.trim()
    ?? null;
  if (interfaceDevUrl) {
    let parsed: URL;
    try {
      parsed = new URL(interfaceDevUrl);
    } catch {
      throw new TypeError("--interface-dev-url must be a valid URL.");
    }
    if (parsed.protocol !== "http:") {
      throw new TypeError("--interface-dev-url must use http.");
    }
  }
  return {
    host: args.get("--host")
      ?? env.OMNIHARNESS_RUNNER_HOST?.trim()
      ?? "0.0.0.0",
    port: readPort(
      args.get("--port")
        ?? env.OMNIHARNESS_RUNNER_PORT
        ?? env.PORT,
      "--port",
      3050,
    ),
    bridgeUrl,
    manageBridge: !["0", "false"].includes(
      env.OMNIHARNESS_MANAGE_BRIDGE?.trim().toLowerCase() ?? "",
    ),
    repositoryRoot,
    instanceRoot,
    databasePath: path.join(instanceRoot, "sqlite.db"),
    bridgeLockPath: path.join(instanceRoot, "bridge.lock.json"),
    runnerLockPath: path.join(instanceRoot, "runner.lock.json"),
    staticDir: staticDisabled
      ? null
      : explicitStaticDir
        ? path.resolve(explicitStaticDir)
        : path.join(repositoryRoot, "dist", "interface"),
    staticDirExplicit: explicitStaticDir !== null,
    staticDisabled,
    interfaceDevUrl,
  };
}
