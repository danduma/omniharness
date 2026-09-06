import { ingestForeignNamedEvent, type NamedEvent } from "@/server/events/named-events";

/**
 * OmniHarness runs the ACP clients in a separate process (`scripts/agent-runtime.ts`,
 * the "bridge"), and `emitNamedEvent` writes to a ring buffer that is local to
 * whichever process called it. The runner is the only process that serves SSE,
 * so every lifecycle event emitted in the agent runtime landed in a buffer no
 * client ever read: goals the agent announced, surfaced ACP errors, plan
 * frames. Users saw the effects only after a snapshot bootstrap re-read the
 * database — which is why a goal set by the agent appeared only after switching
 * conversations.
 *
 * This forwarder long-polls the bridge's `/runtime-events` drain and replays
 * what it finds into the runner's own ring. The pull direction is deliberate:
 * the bridge may be adopted rather than spawned, and may not know the runner's
 * address, but the runner always knows the bridge URL.
 */

/**
 * Kinds the runner already emits for the same subject, which would otherwise
 * arrive twice.
 *
 * `worker.entry_appended` is the whole list. The bridge emits one per append
 * from the ACP plan stream, while the runner emits one per batch from
 * `writeWorkerOutputEntries` as it reconciles the same content — so clients
 * already receive these, and forwarding would multiply the hottest frame in the
 * system by the batch size for no new information. Every other kind the bridge
 * emits has no runner-side counterpart.
 */
const LOCALLY_EMITTED_EVENT_KINDS = new Set<string>(["worker.entry_appended"]);

const DRAIN_WAIT_MS = 20_000;
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
/**
 * Floor between drains that returned nothing. The bridge's long poll wakes on
 * any stream notification, and plenty of those carry no new named event — a
 * streaming turn notifies per chunk. Without this floor an active turn would
 * spin the drain at chunk rate.
 */
const IDLE_FLOOR_MS = 250;

type ForeignEntry = {
  runId?: string | null;
  event?: unknown;
};

type DrainResponse = {
  epoch?: unknown;
  cursor?: unknown;
  resyncRequired?: unknown;
  resyncReason?: unknown;
  events?: unknown;
};

export type BridgeEventForwarderOptions = {
  bridgeUrl: string;
  fetchImpl?: typeof fetch;
  ingest?: (event: NamedEvent, runId?: string | null) => unknown;
  /** Overridable so tests do not wait on real timers. */
  sleep?: (ms: number) => Promise<void>;
  waitMs?: number;
  onDiagnostic?: (message: string) => void;
};

function isNamedEvent(value: unknown): value is NamedEvent {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { kind?: unknown }).kind === "string";
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

export class BridgeNamedEventForwarder {
  private readonly bridgeUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ingest: (event: NamedEvent, runId?: string | null) => unknown;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly waitMs: number;
  private readonly onDiagnostic: (message: string) => void;

  private running = false;
  private loop: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private cursor: string | null = null;
  private backoffMs = MIN_BACKOFF_MS;

  constructor(options: BridgeEventForwarderOptions) {
    this.bridgeUrl = options.bridgeUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.ingest = options.ingest ?? ingestForeignNamedEvent;
    this.sleep = options.sleep ?? defaultSleep;
    this.waitMs = options.waitMs ?? DRAIN_WAIT_MS;
    this.onDiagnostic = options.onDiagnostic
      ?? ((message) => process.stderr.write(`[bridge-events] ${message}\n`));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
  }

  async stop() {
    this.running = false;
    this.abortController?.abort();
    await this.loop?.catch(() => undefined);
    this.loop = null;
  }

  /**
   * One drain round-trip. Exposed so tests can step the forwarder without
   * running its loop, and so `start()` stays a thin wrapper around it.
   */
  async drainOnce(): Promise<{ ingested: number; resynced: boolean } | null> {
    const url = new URL(`${this.bridgeUrl}/runtime-events`);
    if (this.cursor) url.searchParams.set("since", this.cursor);
    url.searchParams.set("waitMs", String(this.waitMs));

    this.abortController = new AbortController();
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), { signal: this.abortController.signal });
    } finally {
      this.abortController = null;
    }
    if (!response.ok) {
      throw new Error(`The bridge event drain returned HTTP ${response.status}.`);
    }

    const body = await response.json() as DrainResponse;
    const cursor = typeof body.cursor === "string" ? body.cursor : null;
    let resynced = false;

    if (body.resyncRequired === true) {
      // The bridge restarted, or we fell out of its ring. Its events are gone
      // either way; resume from head rather than replaying a broken sequence.
      this.onDiagnostic(
        `resuming from head after the bridge reported ${String(body.resyncReason ?? "a resync")}`,
      );
      this.cursor = cursor;
      return { ingested: 0, resynced: true };
    }

    let ingested = 0;
    for (const candidate of Array.isArray(body.events) ? body.events : []) {
      const entry = candidate as ForeignEntry;
      if (!isNamedEvent(entry.event)) continue;
      if (LOCALLY_EMITTED_EVENT_KINDS.has(entry.event.kind)) continue;
      this.ingest(entry.event, typeof entry.runId === "string" ? entry.runId : null);
      ingested += 1;
    }
    if (cursor) this.cursor = cursor;
    return { ingested, resynced };
  }

  private async run() {
    while (this.running) {
      try {
        const result = await this.drainOnce();
        this.backoffMs = MIN_BACKOFF_MS;
        if (this.running && (result?.ingested ?? 0) === 0) {
          await this.sleep(IDLE_FLOOR_MS);
        }
      } catch (error) {
        if (!this.running) return;
        // The bridge restarts, and the runner outlives it. A drain failure is
        // expected during that window, so it backs off rather than spinning —
        // but it is never silent, because a permanently failed forwarder means
        // every agent-side event is invisible again.
        this.onDiagnostic(`drain failed: ${error instanceof Error ? error.message : String(error)}`);
        await this.sleep(this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  }
}

export function createBridgeNamedEventForwarder(options: BridgeEventForwarderOptions) {
  return new BridgeNamedEventForwarder(options);
}
