/**
 * Lifecycle harness HTTP/SSE client with chaos hooks.
 *
 * Both fetch and SSE go through the configured `Chaos` instance, so
 * faults are seeded and reproducible. The SSE side auto-reconnects with
 * the last observed event id; tests can call `dropSse()` to force a
 * mid-stream reconnect and assert that `Last-Event-ID` resume holds.
 */
import { SseClient, EventRecorder, type ParsedNamedEvent } from "./sse";
import { Chaos, NO_CHAOS } from "./chaos";

export interface LifecycleClientOptions {
  baseUrl: string;
  chaos?: Chaos;
}

export class LifecycleClient {
  readonly events = new EventRecorder();
  private sse: SseClient | null = null;
  private autoReconnect = true;
  private resumeId: string | null = null;

  constructor(public readonly opts: LifecycleClientOptions) {}

  get chaos(): Chaos {
    return this.opts.chaos ?? new Chaos(0, NO_CHAOS);
  }

  /** Flake-aware fetch. Returns the response or throws. */
  async fetch(input: string, init: RequestInit = {}): Promise<Response> {
    if (this.chaos.shouldFlakeFetch()) {
      const status = this.chaos.pickFlakeStatus();
      return new Response(JSON.stringify({ chaos: true, status }), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    const url = input.startsWith("http") ? input : `${this.opts.baseUrl}${input}`;
    return fetch(url, init);
  }

  async getJson<T = unknown>(pathOrUrl: string): Promise<{ res: Response; body: T }> {
    const res = await this.fetch(pathOrUrl);
    const body = (await res.json()) as T;
    return { res, body };
  }

  /** Bootstrap state from the snapshot endpoint and return its anchor id. */
  async bootstrapSnapshot(runId?: string): Promise<{ snapshot: unknown; lastEventId: string | null }> {
    const qs = new URLSearchParams({ snapshot: "1", persisted: "1" });
    if (runId) qs.set("runId", runId);
    const res = await this.fetch(`/api/events?${qs.toString()}`);
    if (!res.ok) {
      throw new Error(`snapshot bootstrap failed: ${res.status}`);
    }
    const snapshot = await res.json();
    const lastEventId = res.headers.get("x-omni-last-event-id");
    if (lastEventId) {
      this.resumeId = lastEventId;
    }
    return { snapshot, lastEventId };
  }

  /** Subscribe to /api/events from the current resume id. */
  async subscribe(options: { runId?: string; resumeFrom?: string | null } = {}): Promise<void> {
    if (options.resumeFrom !== undefined) {
      this.resumeId = options.resumeFrom;
    }
    this.autoReconnect = true;
    await this.connectSse(options.runId);
  }

  private async connectSse(runId: string | undefined): Promise<void> {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    const url = runId
      ? `${this.opts.baseUrl}/api/events?runId=${encodeURIComponent(runId)}`
      : `${this.opts.baseUrl}/api/events`;
    this.sse = new SseClient({
      url,
      lastEventId: this.resumeId,
      onFrame: (frame) => {
        if (frame.id) {
          this.resumeId = frame.id;
        }
        this.events.feed(frame);
      },
      onClose: (reason) => {
        if (reason === "abort") {
          return;
        }
        if (this.autoReconnect && !this.chaos.shouldDropSse()) {
          // Reconnect quickly in normal close cases (server told us we're done
          // or network blip). Tests that want to assert reconnect timing
          // should drive it explicitly via dropSse().
          setTimeout(() => {
            if (this.autoReconnect) {
              void this.connectSse(runId);
            }
          }, 25);
        }
      },
    });
    await this.sse.start();
  }

  /** Force-close the current SSE stream. Test should subsequently call
   *  `subscribe()` (with no args) to reconnect from the recorded
   *  `Last-Event-ID`. While dropped, the auto-reconnect path is off so
   *  the explicit subscribe() call is the only thing that re-opens the
   *  stream — preventing duplicate streams under chaos. */
  dropSse(): void {
    this.autoReconnect = false;
    this.sse?.close();
    this.sse = null;
  }

  resumeIdNow(): string | null {
    return this.resumeId;
  }

  async close(): Promise<void> {
    this.autoReconnect = false;
    this.sse?.close();
    await this.sse?.waitForClose();
    this.sse = null;
  }

  /** Convenience: wait for a named event on the SSE recorder. */
  async waitFor(eventName: string, options?: {
    predicate?: (frame: ParsedNamedEvent) => boolean;
    timeoutMs?: number;
  }): Promise<ParsedNamedEvent> {
    return this.events.waitFor(eventName, options);
  }
}
