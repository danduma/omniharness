export const DEFAULT_DEV_PREWARM_PATHS = [
  "/",
  "/api/events?snapshot=1&persisted=1",
  "/api/auth/session",
  "/api/settings",
  "/api/agents/catalog",
] as const;

export type DevPrewarmResult = {
  path: string;
  status: number | null;
  elapsedMs: number;
  error: string | null;
};

type DevPrewarmOptions = {
  baseUrl: string;
  paths: string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function unique(paths: string[]) {
  return Array.from(new Set(paths));
}

function parsePathList(value: string | undefined) {
  return (value ?? "")
    .split(/[\s,]+/g)
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => path.startsWith("/") ? path : `/${path}`);
}

export function resolveDevPrewarmPaths(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const mode = env.OMNIHARNESS_DEV_PREWARM?.trim().toLowerCase();
  if (mode === "0" || mode === "false" || mode === "off") {
    return [];
  }

  const configuredPaths = parsePathList(env.OMNIHARNESS_DEV_PREWARM_PATHS);
  const basePaths = configuredPaths.length > 0
    ? configuredPaths
    : [...DEFAULT_DEV_PREWARM_PATHS];
  return unique([
    ...basePaths,
    ...parsePathList(env.OMNIHARNESS_DEV_PREWARM_EXTRA_PATHS),
  ]);
}

export function isNextDevReadyLine(line: string) {
  return /(?:^|\s)(?:✓|✔)?\s*Ready in\s+\d/i.test(line);
}

export function resolveDevPrewarmBaseUrl(webHost: string, webPort: string) {
  const host = webHost.trim();
  if (!host || host === "0.0.0.0" || host === "::") {
    return `http://127.0.0.1:${webPort}`;
  }

  if (host.includes(":") && !host.startsWith("[")) {
    return `http://[${host}]:${webPort}`;
  }

  return `http://${host}:${webPort}`;
}

async function fetchPrewarmPath(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  timeoutMs: number,
): Promise<DevPrewarmResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(new URL(path, baseUrl), {
      headers: {
        Accept: "text/html,application/json,*/*",
      },
      signal: controller.signal,
    });
    await response.arrayBuffer();
    return {
      path,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      path,
      status: null,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function prewarmDevPaths({
  baseUrl,
  paths,
  fetchImpl = fetch,
  timeoutMs = 120_000,
}: DevPrewarmOptions) {
  const results: DevPrewarmResult[] = [];
  for (const path of paths) {
    results.push(await fetchPrewarmPath(fetchImpl, baseUrl, path, timeoutMs));
  }
  return results;
}
