import { describe, expect, it } from "vitest";
import {
  compareEventStreamIds,
  formatEventStreamId,
  parseEventStreamId,
} from "@/shared/runtime";

describe("event stream ids", () => {
  it("formats and parses an epoch plus sequence", () => {
    const id = formatEventStreamId("epoch_A-1", 42);

    expect(id).toBe("epoch_A-1:42");
    expect(parseEventStreamId(id)).toEqual({
      epoch: "epoch_A-1",
      sequence: 42,
    });
  });

  it("accepts a zero snapshot anchor and rejects malformed or unsafe ids", () => {
    expect(parseEventStreamId("epoch:0")).toEqual({ epoch: "epoch", sequence: 0 });
    expect(parseEventStreamId("")).toBeNull();
    expect(parseEventStreamId("epoch")).toBeNull();
    expect(parseEventStreamId("epoch:-1")).toBeNull();
    expect(parseEventStreamId("epoch:1.5")).toBeNull();
    expect(parseEventStreamId("bad epoch:1")).toBeNull();
    expect(parseEventStreamId(`epoch:${Number.MAX_SAFE_INTEGER + 1}`)).toBeNull();
  });

  it("orders only ids from the same epoch", () => {
    expect(compareEventStreamIds("epoch:2", "epoch:1")).toBe(1);
    expect(compareEventStreamIds("epoch:1", "epoch:1")).toBe(0);
    expect(compareEventStreamIds("epoch:1", "epoch:2")).toBe(-1);
    expect(compareEventStreamIds("new:1", "old:999")).toBeNull();
  });
});
