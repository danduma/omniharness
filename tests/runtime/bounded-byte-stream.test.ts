import { describe, expect, it, vi } from "vitest";
import { createBoundedByteStream } from "@/runtime/http/bounded-byte-stream";

describe("createBoundedByteStream", () => {
  it("delivers queued chunks in order as the consumer pulls", async () => {
    const encoder = new TextEncoder();
    const stream = createBoundedByteStream({
      start(writer) {
        expect(writer.enqueue(encoder.encode("one"))).toBe(true);
        expect(writer.enqueue(encoder.encode("two"))).toBe(true);
        writer.close();
      },
    });

    const reader = stream.getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode("one"),
    });
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode("two"),
    });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it("cancels the producer when the consumer cancels", async () => {
    const onCancel = vi.fn();
    const stream = createBoundedByteStream({
      start() {},
      cancel: onCancel,
    });

    await stream.cancel("client left");

    expect(onCancel).toHaveBeenCalledWith("client left");
  });

  it("closes and reports an overflow before exceeding either queue bound", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    let accepted = true;
    const stream = createBoundedByteStream({
      maxQueuedFrames: 2,
      maxQueuedBytes: 8,
      onOverflow,
      start(writer) {
        accepted = writer.enqueue(encoder.encode("333"));
        accepted = writer.enqueue(encoder.encode("444"));
        accepted = writer.enqueue(encoder.encode("5"));
      },
    });

    expect(accepted).toBe(false);
    expect(onOverflow).toHaveBeenCalledWith({
      queuedFrames: 2,
      queuedBytes: 6,
      rejectedBytes: 1,
    });
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});
