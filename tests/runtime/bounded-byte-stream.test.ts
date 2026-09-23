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

  it("closes and reports an overflow once the frame bound is reached", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    let accepted = true;
    const stream = createBoundedByteStream({
      maxQueuedFrames: 2,
      maxQueuedBytes: 1024,
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

  it("closes and reports an overflow once the waiting bytes exceed the budget", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const accepted: boolean[] = [];
    const stream = createBoundedByteStream({
      maxQueuedBytes: 8,
      onOverflow,
      start(writer) {
        accepted.push(writer.enqueue(encoder.encode("1234")));
        accepted.push(writer.enqueue(encoder.encode("5678")));
        // Exactly at the budget is not yet a backlog that has outgrown it.
        accepted.push(writer.enqueue(encoder.encode("9")));
        accepted.push(writer.enqueue(encoder.encode("0")));
      },
    });

    expect(accepted).toEqual([true, true, true, false]);
    expect(onOverflow).toHaveBeenCalledWith({ queuedFrames: 3, queuedBytes: 9, rejectedBytes: 1 });
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("queues a frame larger than the byte budget instead of refusing it", async () => {
    // Reported regression: the catalog snapshot grew past the byte budget, so
    // it was refused whenever a heartbeat happened to be waiting ahead of it,
    // the client was told to resync, reconnected, received the same snapshot,
    // and was told to resync again — which the UI showed as a degraded
    // connection for as long as the catalog stayed large. The budget bounds a
    // backlog; the size of the next frame says nothing about whether the
    // subscriber has fallen behind.
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const accepted: boolean[] = [];
    const stream = createBoundedByteStream({
      maxQueuedBytes: 8,
      onOverflow,
      start(writer) {
        accepted.push(writer.enqueue(encoder.encode("123")));
        accepted.push(writer.enqueue(encoder.encode("far too long to ever fit")));
        writer.close();
      },
    });

    expect(accepted).toEqual([true, true]);
    expect(onOverflow).not.toHaveBeenCalled();
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toMatchObject({ done: false, value: encoder.encode("123") });
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode("far too long to ever fit"),
    });
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("overflows only once a large frame is still waiting when the next one arrives", async () => {
    const encoder = new TextEncoder();
    const onOverflow = vi.fn();
    const accepted: boolean[] = [];
    const stream = createBoundedByteStream({
      maxQueuedBytes: 8,
      onOverflow,
      start(writer) {
        accepted.push(writer.enqueue(encoder.encode("far too long to ever fit")));
        accepted.push(writer.enqueue(encoder.encode("9")));
      },
    });

    expect(accepted).toEqual([true, false]);
    expect(onOverflow).toHaveBeenCalledWith({ queuedFrames: 1, queuedBytes: 24, rejectedBytes: 1 });
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });
});
