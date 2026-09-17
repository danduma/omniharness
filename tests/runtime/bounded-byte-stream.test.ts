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

  it("queues a lone frame larger than the byte budget instead of disconnecting", async () => {
    // Reported regression: the opening event-stream snapshot grew 84 bytes past
    // the 1 MiB budget, so the first frame of every connection was rejected on
    // an empty queue and the subscriber was dropped as "slow". The budget
    // bounds a backlog; one frame nobody is behind on is not a backlog.
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const onOversizedFrame = vi.fn();
    let accepted = false;
    const stream = createBoundedByteStream({
      maxQueuedBytes: 4,
      onOverflow,
      onOversizedFrame,
      start(writer) {
        accepted = writer.enqueue(encoder.encode("far too long"));
      },
    });

    expect(accepted).toBe(true);
    expect(onOverflow).not.toHaveBeenCalled();
    expect(onOversizedFrame).not.toHaveBeenCalled();
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode("far too long"),
    });
  });

  it("offers an unfittable frame to the caller rather than closing the stream", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const onOversizedFrame = vi.fn();
    const accepted: boolean[] = [];
    const stream = createBoundedByteStream({
      maxQueuedBytes: 8,
      onOverflow,
      onOversizedFrame,
      start(writer) {
        accepted.push(writer.enqueue(encoder.encode("123")));
        accepted.push(writer.enqueue(encoder.encode("far too long to ever fit")));
        accepted.push(writer.enqueue(encoder.encode("ok")));
        writer.close();
      },
    });

    expect(accepted).toEqual([true, false, true]);
    expect(onOversizedFrame).toHaveBeenCalledWith({ rejectedBytes: 24, maxQueuedBytes: 8 });
    expect(onOverflow).not.toHaveBeenCalled();
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toMatchObject({ done: false, value: encoder.encode("123") });
    await expect(reader.read()).resolves.toMatchObject({ done: false, value: encoder.encode("ok") });
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("still overflows a genuine backlog when no oversized handler applies", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const onOversizedFrame = vi.fn();
    const accepted: boolean[] = [];
    const stream = createBoundedByteStream({
      maxQueuedBytes: 8,
      onOverflow,
      onOversizedFrame,
      start(writer) {
        accepted.push(writer.enqueue(encoder.encode("1234")));
        accepted.push(writer.enqueue(encoder.encode("5678")));
        accepted.push(writer.enqueue(encoder.encode("9")));
      },
    });

    expect(accepted).toEqual([true, true, false]);
    expect(onOversizedFrame).not.toHaveBeenCalled();
    expect(onOverflow).toHaveBeenCalledWith({ queuedFrames: 2, queuedBytes: 8, rejectedBytes: 1 });
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });
});
