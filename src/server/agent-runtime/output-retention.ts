import { readdirSync, statSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { emitNamedEvent } from "@/server/events/named-events";
import { resolveAgentRuntimeDataDir } from "./output-store";

const RAW_OUTPUT_ARCHIVE_PATTERN = /\.jsonl(?:\..+\.prev)?$/;
const NOTICE_REPEAT_AFTER_MS = 15 * 60_000;

type ArchiveCandidate = {
  filePath: string;
  modifiedAt: number;
  size: number;
};

export type RuntimeOutputRetentionReport = {
  directory: string;
  scannedFiles: number;
  deletedFiles: number;
  deletedBytes: number;
  remainingBytes: number;
  deferredBytes: number;
  protectedFiles: number;
  protectedBytes: number;
  failures: number;
};

function describeUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function summarizeErrors(errors: string[]) {
  const visible = errors.slice(0, 5);
  if (errors.length > visible.length) {
    visible.push(`${errors.length - visible.length} more cleanup failure(s)`);
  }
  return visible.join("; ");
}

function emptyReport(directory: string): RuntimeOutputRetentionReport {
  return {
    directory,
    scannedFiles: 0,
    deletedFiles: 0,
    deletedBytes: 0,
    remainingBytes: 0,
    deferredBytes: 0,
    protectedFiles: 0,
    protectedBytes: 0,
    failures: 0,
  };
}

export class RuntimeOutputRetentionManager {
  private readonly lastNoticeAt = new Map<"deferred" | "failed", number>();

  sweep(input: {
    dataDir?: string | null;
    rootDir?: string | null;
    maxBytes: number;
    protectedPaths: ReadonlySet<string>;
  }): RuntimeOutputRetentionReport {
    const directory = join(resolveAgentRuntimeDataDir(input), "agent-runtime-output");
    const report = emptyReport(directory);
    const errors: string[] = [];
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return report;
      this.emitFailure(directory, [describeUnknownError(error)]);
      return { ...report, failures: 1 };
    }

    const protectedPaths = new Set(Array.from(input.protectedPaths, (filePath) => resolve(filePath)));
    const candidates: ArchiveCandidate[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !RAW_OUTPUT_ARCHIVE_PATTERN.test(entry.name)) continue;
      const filePath = join(directory, entry.name);
      try {
        const stats = statSync(filePath);
        candidates.push({ filePath, modifiedAt: stats.mtimeMs, size: stats.size });
      } catch (error) {
        errors.push(`${entry.name}: ${describeUnknownError(error)}`);
      }
    }

    candidates.sort((left, right) => left.modifiedAt - right.modifiedAt
      || left.filePath.localeCompare(right.filePath));
    report.scannedFiles = candidates.length;
    report.remainingBytes = candidates.reduce((total, candidate) => total + candidate.size, 0);

    const protectedCandidates = candidates.filter((candidate) => protectedPaths.has(resolve(candidate.filePath)));
    report.protectedFiles = protectedCandidates.length;
    report.protectedBytes = protectedCandidates.reduce((total, candidate) => total + candidate.size, 0);

    const maxBytes = Math.max(0, Math.floor(input.maxBytes));
    for (const candidate of candidates) {
      if (report.remainingBytes <= maxBytes) break;
      if (protectedPaths.has(resolve(candidate.filePath))) continue;
      try {
        unlinkSync(candidate.filePath);
        report.deletedFiles += 1;
        report.deletedBytes += candidate.size;
        report.remainingBytes -= candidate.size;
      } catch (error) {
        errors.push(`${candidate.filePath}: ${describeUnknownError(error)}`);
      }
    }

    report.failures = errors.length;
    report.deferredBytes = Math.max(0, report.remainingBytes - maxBytes);

    if (report.deletedFiles > 0) {
      emitNamedEvent({
        kind: "runtime.output_logs_pruned",
        deletedFiles: report.deletedFiles,
        deletedBytes: report.deletedBytes,
        remainingBytes: report.remainingBytes,
        maxBytes,
      });
    }
    if (errors.length > 0) {
      this.emitFailure(directory, errors);
    } else {
      this.lastNoticeAt.delete("failed");
    }
    if (report.deferredBytes > 0) {
      if (this.shouldEmitNotice("deferred")) {
        emitNamedEvent({
          kind: "runtime.output_logs_prune_deferred",
          remainingBytes: report.remainingBytes,
          maxBytes,
          protectedFiles: report.protectedFiles,
          protectedBytes: report.protectedBytes,
        });
      }
    } else {
      this.lastNoticeAt.delete("deferred");
    }

    return report;
  }

  private emitFailure(directory: string, errors: string[]) {
    if (!this.shouldEmitNotice("failed")) return;
    const reason = summarizeErrors(errors);
    emitNamedEvent({
      kind: "runtime.output_logs_prune_failed",
      directory,
      failures: errors.length,
      reason,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "runtime.output_logs_prune_failed",
      message: `Raw worker log cleanup failed: ${reason}`,
      surface: "log",
    });
  }

  private shouldEmitNotice(kind: "deferred" | "failed") {
    const now = Date.now();
    const lastNoticeAt = this.lastNoticeAt.get(kind);
    if (lastNoticeAt !== undefined && now - lastNoticeAt < NOTICE_REPEAT_AFTER_MS) return false;
    this.lastNoticeAt.set(kind, now);
    return true;
  }
}
