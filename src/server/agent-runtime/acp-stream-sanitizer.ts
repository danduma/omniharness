/**
 * Defensive wrapper around an ACP stream that normalizes incoming
 * `session/update` notifications before they reach the SDK's zod
 * validator.
 *
 * Background: `acp.ClientSideConnection` validates every `session/update`
 * via `zSessionNotification.parse(params)`. When validation fails it
 * logs `Error handling notification` to stderr and **silently drops the
 * entire notification** — the agent runtime never records the
 * tool_call / message_chunk / thought, the worker stream stops
 * advancing, and the user sees a hung session even though the SDK is
 * still streaming. Concrete failures we've seen so far:
 *
 *   - `claude-agent-acp` emits ToolCallLocation `line` as a
 *     `[startLine, endLine]` tuple for range reads; the schema requires
 *     `uint32 | null`.
 *
 * Rather than chasing one field at a time, this sanitizer pre-validates
 * each notification against the SDK's own zod schema and, for any
 * issue, walks the path and replaces the offending value with the
 * closest schema-conforming approximation (first uint32 in an array
 * for number-or-null fields; `null` for everything else). Failures are
 * logged to `.omniharness/bridge-validation-failures.log` so we can
 * widen the salvage rules when a new field shape shows up.
 */
import { promises as fs } from "fs";
import path from "path";
import type * as acp from "@agentclientprotocol/sdk";
import { zSessionNotification } from "@agentclientprotocol/sdk/dist/schema/zod.gen.js";
import { getAppDataPath } from "@/server/app-root";

// The SDK ships generated schemas built against zod 4's issue shape
// (nested `errors` arrays, etc), but our installed zod is the 3.x line
// where `z.ZodIssue` is the v3 type. Rather than fight the typings,
// treat the issue payload as opaque and pull out the two fields we
// rely on (`code`, `path`) defensively at runtime.
interface ZodIssueLike {
  readonly code: string;
  readonly path: ReadonlyArray<PropertyKey>;
  readonly [extra: string]: unknown;
}

type AcpStream = ConstructorParameters<typeof acp.ClientSideConnection>[1];

const FAILURE_LOG_PATH = getAppDataPath(".omniharness/bridge-validation-failures.log");
const MAX_UINT32 = 4_294_967_295;
const MAX_SALVAGE_PASSES = 8;

export function sanitizeAcpStream(stream: AcpStream): AcpStream {
  const readable = new ReadableStream({
    async start(controller) {
      const reader = stream.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          controller.enqueue(sanitizeIncomingMessage(value));
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
  return { readable, writable: stream.writable };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Top-level sanitizer. For `session/update` notifications, pre-validate
 * `params` against the SDK schema and salvage any zod issues. For all
 * other messages, pass through unchanged.
 */
export function sanitizeIncomingMessage(message: unknown): unknown {
  if (!isRecord(message) || message.method !== "session/update") {
    return message;
  }
  const params = message.params;
  if (!isRecord(params)) {
    return message;
  }

  // Cheap targeted pass first — fixes the known ToolCallLocation.line
  // tuple shape without needing to walk the zod tree.
  fastPathRepairs(params);

  const initial = zSessionNotification.safeParse(params);
  if (initial.success) {
    return message;
  }

  // Mutate-in-place repair loop. Each pass applies all current issues,
  // then re-validates. Bounded to avoid an infinite loop on
  // pathological inputs.
  const initialIssues = (initial.error.issues as unknown) as ReadonlyArray<ZodIssueLike>;
  let lastIssues: ReadonlyArray<ZodIssueLike> = initialIssues;
  for (let pass = 0; pass < MAX_SALVAGE_PASSES; pass += 1) {
    let changed = false;
    for (const issue of lastIssues) {
      if (applyIssueRepair(params, issue)) {
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
    const reparsed = zSessionNotification.safeParse(params);
    if (reparsed.success) {
      void logFailure({
        kind: "salvaged",
        message,
        initialIssues,
        passes: pass + 1,
      });
      return message;
    }
    lastIssues = (reparsed.error.issues as unknown) as ReadonlyArray<ZodIssueLike>;
  }

  // Couldn't fully salvage — log and pass through. acp.js will then
  // reject it; at least we have the full record on disk to debug.
  void logFailure({
    kind: "unsalvaged",
    message,
    initialIssues,
    finalIssues: lastIssues,
  });
  return message;
}

/** Known patterns where a targeted rewrite is cheaper than a zod walk. */
function fastPathRepairs(params: Record<string, unknown>) {
  const update = isRecord(params.update) ? params.update : null;
  if (!update) return;
  const locations = update.locations;
  if (Array.isArray(locations)) {
    for (const loc of locations) {
      if (isRecord(loc) && "line" in loc) {
        loc.line = coerceLineField(loc.line);
      }
    }
  }
}

function coerceLineField(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (isUint32(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (isUint32(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function isUint32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_UINT32;
}

/**
 * Generic repair: given a zod issue, mutate the value at issue.path so
 * the next parse pass succeeds. Returns true if anything changed.
 */
function applyIssueRepair(root: Record<string, unknown>, issue: ZodIssueLike): boolean {
  const path = issue.path;
  if (path.length === 0) {
    return false;
  }
  const parent = navigateToParent(root, path);
  if (parent === null) {
    return false;
  }
  const key = path[path.length - 1] as string | number;
  const current = (parent as Record<string | number, unknown>)[key];

  const replacement = chooseReplacement(issue, current);
  if (replacement === KEEP) {
    return false;
  }
  (parent as Record<string | number, unknown>)[key] = replacement;
  return true;
}

const KEEP = Symbol("keep");
type Repair = unknown | typeof KEEP;

/**
 * Pick a schema-conforming stand-in for a value the validator rejected.
 *
 * Heuristics in priority order:
 *   - Array of numbers being asked for a single number → first valid
 *     element (preserves a navigable location for range reads).
 *   - "Expected number / received string": parse as integer, else null.
 *   - Any other invalid_type / invalid_union: null.
 *   - Unrecognized keys: leave the value (parent's strict mode will
 *     pass after we null the field; do not delete to avoid TS issues).
 *
 * Returns KEEP when no safe replacement is available — caller leaves
 * it as-is and we'll log it as unsalvaged.
 */
function chooseReplacement(_issue: ZodIssueLike, current: unknown): Repair {
  // Refuse to null an object or array — that would strip out whole
  // session_update payloads (content blocks, plan entries, etc) just
  // because a nested leaf failed. The salvage loop pre-walks into
  // nested issues, so leaves get repaired individually; non-leaf
  // failures fall through to the unsalvaged log so we can extend the
  // rules deliberately rather than corrupting data.
  if (isRecord(current) || Array.isArray(current)) {
    if (Array.isArray(current)) {
      for (const candidate of current) {
        if (isUint32(candidate)) {
          return candidate;
        }
      }
    }
    return KEEP;
  }
  if (typeof current === "string") {
    const parsed = Number.parseInt(current, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_UINT32) {
      return parsed;
    }
  }
  // Leaf scalar that doesn't fit the schema — nulling is the safest
  // approximation (and matches the `uint32 | null` pattern we keep
  // hitting in ToolCallLocation.line and similar fields).
  return null;
}

function navigateToParent(root: Record<string, unknown>, path: ReadonlyArray<PropertyKey>): unknown {
  let cursor: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (cursor === null || cursor === undefined) {
      return null;
    }
    const segment = path[i];
    if (Array.isArray(cursor)) {
      if (typeof segment !== "number") return null;
      cursor = cursor[segment];
    } else if (isRecord(cursor)) {
      cursor = cursor[segment as string];
    } else {
      return null;
    }
  }
  return cursor ?? null;
}

let failureLogInitPromise: Promise<void> | null = null;
async function logFailure(payload: {
  kind: "salvaged" | "unsalvaged";
  message: unknown;
  initialIssues: ReadonlyArray<ZodIssueLike>;
  finalIssues?: ReadonlyArray<ZodIssueLike>;
  passes?: number;
}) {
  try {
    if (!failureLogInitPromise) {
      failureLogInitPromise = fs.mkdir(path.dirname(FAILURE_LOG_PATH), { recursive: true }).then(() => undefined);
    }
    await failureLogInitPromise;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...payload,
    }) + "\n";
    await fs.appendFile(FAILURE_LOG_PATH, line, "utf8");
  } catch {
    // Logging failures should never crash the pipeline.
  }
}
