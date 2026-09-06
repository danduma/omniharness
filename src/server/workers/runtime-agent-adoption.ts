const DEFAULT_POLL_MS = 100;
const DEFAULT_TIMEOUT_MS = 30_000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isConcurrentAgentStartError(error: unknown, workerId: string) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes(workerId.toLowerCase())
    && (message.includes("agent already exists") || message.includes("agent is already starting"))
  );
}

export function isRuntimeAgentMissingError(error: unknown) {
  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(
    errorMessage(error),
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withDeadline<T>(operation: Promise<T>, remainingMs: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Runtime agent lookup timed out.")),
          Math.max(1, remainingMs),
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function waitForConcurrentAgentStart<T>(args: {
  workerId: string;
  getAgent: (workerId: string) => Promise<T>;
  assertCurrent?: () => Promise<void>;
  pollMs?: number;
  timeoutMs?: number;
}) {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = args.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastMissingError: unknown = null;

  while (true) {
    await args.assertCurrent?.();
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw Object.assign(
        new Error(`Worker recovery did not finish within ${timeoutMs / 1_000} seconds.`),
        { cause: lastMissingError },
      );
    }

    try {
      return await withDeadline(args.getAgent(args.workerId), remainingMs);
    } catch (error) {
      if (!isRuntimeAgentMissingError(error)) {
        if (errorMessage(error) === "Runtime agent lookup timed out.") {
          throw Object.assign(
            new Error(`Worker recovery did not finish within ${timeoutMs / 1_000} seconds.`),
            { cause: lastMissingError ?? error },
          );
        }
        throw error;
      }
      lastMissingError = error;
    }

    await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }
}
