/**
 * Minimal SSE consumer built on fetch + ReadableStream.
 *
 * Designed for the lifecycle harness: supports `Last-Event-ID` resume,
 * chaos-driven mid-stream drops, and lets callers wait on a specific
 * named event.
 */
import { TextDecoder } from "node:util";

export interface SseFrame {
  id: string | null;
  event: string;
  data: string;
}

export interface ParsedNamedEvent extends SseFrame {
  /** When the data field is JSON-parseable, this holds the parsed body. */
  payload: Record<string, unknown> | null;
}

export interface SseClientOptions {
  url: string;
  /** Initial Last-Event-ID; null/undefined means start from the live tail. */
  lastEventId?: string | null;
  /** Called for every frame, in order. */
  onFrame: (frame: ParsedNamedEvent) => void;
  /** Called once when the stream closes (with the reason). */
  onClose?: (reason: "abort" | "remote_closed" | "error", error?: unknown) => void;
  /** Additional headers (forwarded to fetch). */
  headers?: Record<string, string>;
}

export class SseClient {
  private controller = new AbortController();
  private closed = false;
  private readPromise: Promise<void> | null = null;

  constructor(private readonly options: SseClientOptions) {}

  async start(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      ...(this.options.headers ?? {}),
    };
    if (this.options.lastEventId != null) {
      headers["Last-Event-ID"] = String(this.options.lastEventId);
    }

    const res = await fetch(this.options.url, {
      headers,
      signal: this.controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE stream failed: ${res.status}`);
    }
    this.readPromise = this.pump(res.body);
  }

  private async pump(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) {
          this.options.onClose?.("remote_closed");
          this.closed = true;
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let separatorIdx: number;
        // SSE frames are separated by a blank line (\n\n).
        while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, separatorIdx);
          buffer = buffer.slice(separatorIdx + 2);
          const parsed = parseSseFrame(raw);
          if (parsed) {
            this.options.onFrame(parsed);
          }
        }
      }
    } catch (error: unknown) {
      const err = error as { name?: string } | undefined;
      if (err && err.name === "AbortError") {
        this.options.onClose?.("abort");
      } else {
        this.options.onClose?.("error", error);
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.controller.abort();
  }

  async waitForClose(): Promise<void> {
    if (this.readPromise) {
      await this.readPromise.catch(() => {
        // surfaced via onClose
      });
    }
  }
}

function parseSseFrame(raw: string): ParsedNamedEvent | null {
  if (!raw.trim() || raw.startsWith(":")) {
    // comment / heartbeat
    return null;
  }
  let id: string | null = null;
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    switch (field) {
      case "id":
        id = value;
        break;
      case "event":
        event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
    }
  }
  if (dataLines.length === 0 && !id) {
    return null;
  }
  const data = dataLines.join("\n");
  let payload: Record<string, unknown> | null = null;
  if (data) {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = null;
    }
  }
  return { id, event, data, payload };
}

/**
 * Record-and-assert helper. Subscribes to frames, buffers them, and
 * exposes a `waitFor` that resolves when an event matching the predicate
 * arrives.
 */
export class EventRecorder {
  readonly frames: ParsedNamedEvent[] = [];
  private waiters: Array<{
    predicate: (frame: ParsedNamedEvent) => boolean;
    resolve: (frame: ParsedNamedEvent) => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  feed(frame: ParsedNamedEvent): void {
    this.frames.push(frame);
    this.waiters = this.waiters.filter((waiter) => {
      if (waiter.predicate(frame)) {
        clearTimeout(waiter.timeout);
        waiter.resolve(frame);
        return false;
      }
      return true;
    });
  }

  waitFor(
    eventName: string,
    options: { predicate?: (frame: ParsedNamedEvent) => boolean; timeoutMs?: number } = {},
  ): Promise<ParsedNamedEvent> {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const predicate = (frame: ParsedNamedEvent) =>
      frame.event === eventName && (options.predicate ? options.predicate(frame) : true);
    const existing = this.frames.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<ParsedNamedEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.predicate !== predicate);
        reject(new Error(
          `Timed out after ${timeoutMs}ms waiting for SSE event "${eventName}". ` +
          `Observed: ${this.frames.map((f) => f.event).join(", ") || "(none)"}.`,
        ));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timeout });
    });
  }

  filterByEvent(eventName: string): ParsedNamedEvent[] {
    return this.frames.filter((frame) => frame.event === eventName);
  }

  lastEventId(): string | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const id = this.frames[i]!.id;
      if (id) return id;
    }
    return null;
  }

  reset(): void {
    this.frames.length = 0;
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("EventRecorder reset"));
    }
    this.waiters.length = 0;
  }
}
