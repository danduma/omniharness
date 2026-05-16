import type { SupportedWorkerType } from "@/server/supervisor/worker-types";

export type HandoffSource = "worker" | "synthetic";

export type HandoffReport = {
  task: string;
  progress: string;
  nextSteps: string;
  blockers?: string;
  openQuestions?: string;
  relevantFiles?: string[];
  source: HandoffSource;
  outgoingWorkerType: SupportedWorkerType;
  outgoingWorkerId: string;
  reason: string;
};

const HANDOFF_BLOCK_PATTERN = /```omniharness-handoff\n([\s\S]*?)```/i;

const FIELD_LABELS = {
  TASK: "task",
  PROGRESS: "progress",
  NEXT_STEPS: "nextSteps",
  BLOCKERS: "blockers",
  OPEN_QUESTIONS: "openQuestions",
  RELEVANT_FILES: "relevantFiles",
} as const;

type CanonicalField = (typeof FIELD_LABELS)[keyof typeof FIELD_LABELS];

const FIELD_LABEL_ALIASES: Record<string, CanonicalField> = {
  TASK: "task",
  PROGRESS: "progress",
  NEXT_STEPS: "nextSteps",
  "NEXT STEPS": "nextSteps",
  BLOCKERS: "blockers",
  OPEN_QUESTIONS: "openQuestions",
  "OPEN QUESTIONS": "openQuestions",
  RELEVANT_FILES: "relevantFiles",
  "RELEVANT FILES": "relevantFiles",
};

/**
 * Extract the omniharness-handoff fenced block from a worker reply.
 * Returns the inner text or null if no block is present.
 */
export function extractHandoffBlock(text: string): string | null {
  const match = text.match(HANDOFF_BLOCK_PATTERN);
  if (!match) return null;
  return (match[1] ?? "").trim() || null;
}

function splitFields(block: string): Partial<Record<CanonicalField, string>> {
  const lines = block.split(/\r?\n/);
  const fields: Partial<Record<CanonicalField, string>> = {};
  let currentField: CanonicalField | null = null;
  let currentBuffer: string[] = [];

  const flush = () => {
    if (currentField !== null) {
      fields[currentField] = currentBuffer.join("\n").trim();
    }
  };

  for (const rawLine of lines) {
    const headerMatch = rawLine.match(/^\s*([A-Z][A-Z_ ]*[A-Z])\s*:\s*(.*)$/);
    if (headerMatch) {
      const candidateLabel = headerMatch[1]!.trim().toUpperCase();
      const canonical = FIELD_LABEL_ALIASES[candidateLabel];
      if (canonical) {
        flush();
        currentField = canonical;
        currentBuffer = [];
        const rest = headerMatch[2] ?? "";
        if (rest) currentBuffer.push(rest);
        continue;
      }
    }
    if (currentField !== null) {
      currentBuffer.push(rawLine);
    }
  }
  flush();

  return fields;
}

function parseRelevantFiles(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const entries = raw
    .split(/[\n,]/)
    .map((entry) => entry.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

export type ParseHandoffArgs = {
  text: string;
  outgoingWorkerType: SupportedWorkerType;
  outgoingWorkerId: string;
  reason: string;
};

export type ParseHandoffResult =
  | { ok: true; report: HandoffReport }
  | { ok: false; reason: "no_block" | "missing_required_fields"; missing?: CanonicalField[] };

const REQUIRED_FIELDS: CanonicalField[] = ["task", "progress", "nextSteps"];

export function parseHandoffReply(args: ParseHandoffArgs): ParseHandoffResult {
  const block = extractHandoffBlock(args.text);
  if (!block) return { ok: false, reason: "no_block" };

  const fields = splitFields(block);
  const missing = REQUIRED_FIELDS.filter((field) => !fields[field]);
  if (missing.length > 0) {
    return { ok: false, reason: "missing_required_fields", missing };
  }

  const report: HandoffReport = {
    task: fields.task ?? "",
    progress: fields.progress ?? "",
    nextSteps: fields.nextSteps ?? "",
    blockers: fields.blockers || undefined,
    openQuestions: fields.openQuestions || undefined,
    relevantFiles: parseRelevantFiles(fields.relevantFiles),
    source: "worker",
    outgoingWorkerType: args.outgoingWorkerType,
    outgoingWorkerId: args.outgoingWorkerId,
    reason: args.reason,
  };
  return { ok: true, report };
}
