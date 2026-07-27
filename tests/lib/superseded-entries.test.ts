import { describe, expect, it } from "vitest";
import {
  isSupersededSeq,
  mergeSupersededSeqRanges,
  parseSupersededSeqRanges,
  serializeSupersededSeqRanges,
  withoutSupersededEntries,
} from "@/lib/superseded-entries";

describe("superseded worker stream ranges", () => {
  it("round-trips through storage", () => {
    const serialized = serializeSupersededSeqRanges([{ from: 695, through: 1512 }]);
    expect(serialized).toBe('[{"from":695,"through":1512}]');
    expect(parseSupersededSeqRanges(serialized)).toEqual([{ from: 695, through: 1512 }]);
  });

  it("treats missing or malformed storage as no ranges", () => {
    expect(parseSupersededSeqRanges(null)).toEqual([]);
    expect(parseSupersededSeqRanges("")).toEqual([]);
    expect(parseSupersededSeqRanges("not json")).toEqual([]);
    expect(parseSupersededSeqRanges('{"from":1}')).toEqual([]);
    expect(parseSupersededSeqRanges('[{"from":5,"through":1}]')).toEqual([]);
    expect(serializeSupersededSeqRanges([])).toBeNull();
  });

  it("coalesces overlapping and adjacent rewinds", () => {
    expect(mergeSupersededSeqRanges([
      { from: 10, through: 20 },
      { from: 21, through: 30 },
      { from: 5, through: 12 },
      { from: 60, through: 61 },
    ])).toEqual([
      { from: 5, through: 30 },
      { from: 60, through: 61 },
    ]);
  });

  it("hides only the discarded seqs", () => {
    const ranges = [{ from: 695, through: 1512 }];
    expect(isSupersededSeq(694, ranges)).toBe(false);
    expect(isSupersededSeq(695, ranges)).toBe(true);
    expect(isSupersededSeq(1512, ranges)).toBe(true);
    expect(isSupersededSeq(1513, ranges)).toBe(false);

    const entries = [{ seq: 694 }, { seq: 695 }, { seq: 1200 }, { seq: 1513 }];
    expect(withoutSupersededEntries(entries, ranges)).toEqual([{ seq: 694 }, { seq: 1513 }]);
    expect(withoutSupersededEntries(entries, [])).toEqual(entries);
  });
});
