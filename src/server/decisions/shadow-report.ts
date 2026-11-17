import type { ShadowDecisionLogRecord } from "./shadow";

export type ShadowPointSummary = {
  point: string;
  comparisons: number;
  agreements: number;
  agreementRate: number | null;
  /** `${heuristic} -> ${decided}` → count. */
  confusion: Record<string, number>;
  /** Mean decision-layer confidence where it disagreed with the heuristic. */
  meanConfidenceWhenDisagreeing: number | null;
  escalations: number;
  /** Comparisons where an acting point changed behavior (records before B2 count as not acted). */
  acted: number;
  sampledOut: number;
  costUsd: number;
};

/** Agreement summary per decision point from shadow log records. */
export function summarizeShadowDecisions(records: ReadonlyArray<ShadowDecisionLogRecord>): ShadowPointSummary[] {
  const byPoint = new Map<string, ShadowDecisionLogRecord[]>();
  for (const record of records) {
    byPoint.set(record.point, [...(byPoint.get(record.point) ?? []), record]);
  }
  return [...byPoint.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([point, rows]) => {
    const agreements = rows.filter((row) => row.agree).length;
    const confusion: Record<string, number> = {};
    for (const row of rows) {
      const key = `${row.heuristic} -> ${row.decided}`;
      confusion[key] = (confusion[key] ?? 0) + 1;
    }
    const disagreeConfidences = rows
      .filter((row) => !row.agree && typeof row.confidence === "number")
      .map((row) => row.confidence as number);
    return {
      point,
      comparisons: rows.length,
      agreements,
      agreementRate: rows.length > 0 ? agreements / rows.length : null,
      confusion,
      meanConfidenceWhenDisagreeing: disagreeConfidences.length > 0
        ? disagreeConfidences.reduce((sum, value) => sum + value, 0) / disagreeConfidences.length
        : null,
      escalations: rows.filter((row) => row.escalated).length,
      acted: rows.filter((row) => row.acted === true).length,
      sampledOut: rows.reduce((sum, row) => sum + row.sampledOut, 0),
      costUsd: rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
    };
  });
}

export function parseShadowLog(text: string): ShadowDecisionLogRecord[] {
  return text.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const parsed = JSON.parse(line) as ShadowDecisionLogRecord;
      return typeof parsed.point === "string" && typeof parsed.heuristic === "string" ? [parsed] : [];
    } catch {
      // A torn final line from a crash is skipped, not fatal.
      return [];
    }
  });
}
