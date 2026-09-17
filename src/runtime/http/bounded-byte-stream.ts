export const DEFAULT_MAX_QUEUED_FRAMES = 256;
export const DEFAULT_MAX_QUEUED_BYTES = 1024 * 1024;

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

export interface BoundedByteStreamOversizedFrame {
  rejectedBytes: number;
  maxQueuedBytes: number;
}

export interface BoundedByteStreamOptions {
  start(writer: BoundedByteStreamWriter): void | Promise<void>;
  cancel?(reason: unknown): void | Promise<void>;
  onOverflow?(overflow: BoundedByteStreamOverflow): void;
  /**
   * A single frame too large to ever fit the byte budget, offered to the caller
   * before the stream gives up on it. A subscriber that has consumed everything
   * is not slow, so this is not overflow: the caller drops the frame and sends
   * something smaller in its place, and the connection survives. Without a
   * handler the frame falls through to the overflow path below.
   */
  onOversizedFrame?(frame: BoundedByteStreamOversizedFrame): void;
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

      // The budget bounds a *backlog*, not one frame. A lone frame waiting on a
      // consumer that has taken everything else is not a backlog, and the fast
      // path above already hands one straight through when the consumer happens
      // to be parked in `pull()` — so rejecting the same frame here only because
      // the timing differed is what made an oversized snapshot disconnect the
      // subscriber on a queue holding nothing.
      if (queued.length === 0) {
        queued.push(chunk);
        queuedBytes += chunk.byteLength;
        return true;
      }

      if (chunk.byteLength > maxQueuedBytes && options.onOversizedFrame) {
        // Never fits behind anything, however fast the subscriber drains. Let
        // the caller substitute a smaller frame rather than killing a
        // connection that is keeping up.
        options.onOversizedFrame({
          rejectedBytes: chunk.byteLength,
          maxQueuedBytes,
        });
        return false;
      }

      if (
        queued.length >= maxQueuedFrames
        || queuedBytes + chunk.byteLength > maxQueuedBytes
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
