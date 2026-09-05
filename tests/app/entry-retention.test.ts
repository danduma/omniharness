import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENTRY_RETENTION,
  pruneEntryWindow,
  retainedEntryCount,
  type EntryRetentionPolicy,
} from "@/interface/home/entry-retention";

const POLICY: EntryRetentionPolicy = {
  hotWindow: 10,
  maxRetained: 50,
  scrollbackIdleMs: 1_000,
};

describe("retainedEntryCount", () => {
  it("keeps everything while the window is under the hot limit", () => {
    expect(retainedEntryCount({
      total: 4,
      lastScrollbackAt: null,
      now: 5_000,
      isVisible: true,
      policy: POLICY,
    })).toBe(4);
  });

  it("collapses a streaming window to the hot tail when scroll-back was never used", () => {
    expect(retainedEntryCount({
      total: 20_000,
      lastScrollbackAt: null,
      now: 5_000,
      isVisible: true,
      policy: POLICY,
    })).toBe(10);
  });

  it("raises the ceiling while scroll-back is recent", () => {
    expect(retainedEntryCount({
      total: 20_000,
      lastScrollbackAt: 4_500,
      now: 5_000,
      isVisible: true,
      policy: POLICY,
    })).toBe(50);
  });

  it("collapses again once the scroll-back has gone idle", () => {
    expect(retainedEntryCount({
      total: 20_000,
      lastScrollbackAt: 3_000,
      now: 5_000,
      isVisible: true,
      policy: POLICY,
    })).toBe(10);
  });

  it("ignores recent scroll-back for a stream nothing is rendering", () => {
    expect(retainedEntryCount({
      total: 20_000,
      lastScrollbackAt: 4_999,
      now: 5_000,
      isVisible: false,
      policy: POLICY,
    })).toBe(10);
  });

  it("defaults to a bounded window rather than an unbounded one", () => {
    expect(retainedEntryCount({
      total: 100_000,
      lastScrollbackAt: null,
      now: 0,
      isVisible: true,
    })).toBe(DEFAULT_ENTRY_RETENTION.hotWindow);
  });
});

describe("pruneEntryWindow", () => {
  it("drops from the head and keeps the newest entries", () => {
    expect(pruneEntryWindow([1, 2, 3, 4, 5], 2)).toEqual([4, 5]);
  });

  it("preserves array identity when nothing is dropped", () => {
    const entries = [1, 2, 3];
    expect(pruneEntryWindow(entries, 3)).toBe(entries);
    expect(pruneEntryWindow(entries, 99)).toBe(entries);
  });
});
