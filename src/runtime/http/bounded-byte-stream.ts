export const DEFAULT_MAX_QUEUED_FRAMES = 256;
/**
 * How much may be waiting on a subscriber before it counts as slow. The budget
 * bounds the *backlog*: a frame is only refused when the bytes already waiting
 * exceed it, never because of its own size. A catalog snapshot for a few
 * hundred conversations is over 1 MiB, and refusing frames by their own size
 * meant every such snapshot was replaced with a resync instruction, the client
 * re-bootstrapped, the next snapshot was refused again, and the UI reported the
 * connection as degraded for as long as the catalog stayed large.
 */
export const DEFAULT_MAX_QUEUED_BYTES = 8 * 1024 * 1024;

export interface BoundedByteStreamWriter {
  enqueue(chunk: Uint8Array): boolean;
  close(): void;
  error(reason: unknown): void;
}

export interface BoundedByteStreamOverflow {
  queuedFrames: number;
  queuedBytes: number;
  rejectedBytes: number;
}

export interface BoundedByteStreamOptions {
  start(writer: BoundedByteStreamWriter): void | Promise<void>;
  cancel?(reason: unknown): void | Promise<void>;
  onOverflow?(overflow: BoundedByteStreamOverflow): void;
  maxQueuedFrames?: number;
  maxQueuedBytes?: number;
}

export function createBoundedByteStream(
  options: BoundedByteStreamOptions,
): ReadableStream<Uint8Array> {
  const maxQueuedFrames = options.maxQueuedFrames
    ?? DEFAULT_MAX_QUEUED_FRAMES;
  const maxQueuedBytes = options.maxQueuedBytes
    ?? DEFAULT_MAX_QUEUED_BYTES;
  const queued: Uint8Array[] = [];
  let queuedBytes = 0;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let waitingForChunk = false;
  let closeRequested = false;
  let finished = false;

  const writer: BoundedByteStreamWriter = {
    enqueue(chunk) {
      if (finished || closeRequested) {
        return false;
      }

      if (waitingForChunk && controller) {
        waitingForChunk = false;
        controller.enqueue(chunk);
        return true;
      }

      // The budget bounds a *backlog*, not one frame: a subscriber is slow when
      // what is already waiting on it has outgrown the budget, not when the next
      // frame happens to be large. Judging the frame by its own size made the
      // outcome depend on timing — the same snapshot went through when the
      // consumer was parked in `pull()` and was refused when a heartbeat had
      // landed a moment earlier — and a refused snapshot can never be delivered
      // by retrying, only by shrinking the catalog.
      if (
        queued.length >= maxQueuedFrames
        || queuedBytes > maxQueuedBytes
      ) {
        options.onOverflow?.({
          queuedFrames: queued.length,
          queuedBytes,
          rejectedBytes: chunk.byteLength,
        });
        queued.length = 0;
        queuedBytes = 0;
        closeRequested = true;
        finished = true;
        controller?.close();
        return false;
      }

      queued.push(chunk);
      queuedBytes += chunk.byteLength;
      return true;
    },
    close() {
      if (finished || closeRequested) {
        return;
      }
      closeRequested = true;
      if (queued.length === 0 && controller) {
        finished = true;
        controller.close();
      }
    },
    error(reason) {
      if (finished) {
        return;
      }
      finished = true;
      queued.length = 0;
      queuedBytes = 0;
      controller?.error(reason);
    },
  };

  return new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      Promise.resolve(options.start(writer)).catch((error) => {
        writer.error(error);
      });
    },
    pull(streamController) {
      const chunk = queued.shift();
      if (chunk) {
        queuedBytes -= chunk.byteLength;
        streamController.enqueue(chunk);
        return;
      }
      if (closeRequested) {
        if (!finished) {
          finished = true;
          streamController.close();
        }
        return;
      }
      waitingForChunk = true;
    },
    async cancel(reason) {
      if (finished) {
        return;
      }
      finished = true;
      queued.length = 0;
      queuedBytes = 0;
      await options.cancel?.(reason);
    },
  }, {
    highWaterMark: 0,
  });
}
