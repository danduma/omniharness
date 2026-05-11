import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Agent } from "@mastra/core/agent";
import { db } from "@/server/db";
import { clarifications, executionEvents, messages as dbMessages, runs, settings, supervisorInterventions } from "@/server/db/schema";
import { appendMemory, listMemory, readMemory, writeMemory } from "@/server/supervisor/memory-tools";
import { buildMastraModelConfig, getSupervisorModelConfig, validateSupervisorModelConfig } from "@/server/supervisor/model-config";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";

export type ConsolidationTrigger = "compaction" | "completion" | "failure";

export interface ConsolidationOperation {
  op: "append" | "write" | "noop";
  path: string;
  content: string;
  reason: string;
  evidenceIds?: string[];
}

export interface ConsolidationResult {
  skipped: boolean;
  reason?: string;
  operations: number;
  plan?: ConsolidationOperation[];
}

const MIN_CONSOLIDATION_INTERVAL_MS = 60_000;
const MAX_INPUT_CHARS = 80_000;
const MAX_OPERATIONS = 8;
const MAX_OP_CONTENT_CHARS = 1_500;

function truncate(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function isInfraFailure(reason: string | undefined) {
  if (!reason) {
    return false;
  }
  const normalized = reason.toLowerCase();
  return [
    "quota",
    "rate limit",
    "rate-limit",
    "credit",
    "econn",
    "etimedout",
    "network",
    "bridge",
    "spawn",
    "agent not found",
  ].some((pattern) => normalized.includes(pattern));
}

async function gatherSignals(runId: string, sinceTimestamp: Date) {
  const allClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, runId));
  const answered = allClarifications.filter(
    (clarification) =>
      clarification.status === "answered"
      && typeof clarification.answer === "string"
      && clarification.answer.trim().length > 0
      && clarification.updatedAt > sinceTimestamp,
  );

  const interventions = (await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId)))
    .filter((row) => row.createdAt > sinceTimestamp);

  const userMessages = (await db.select().from(dbMessages).where(eq(dbMessages.runId, runId)))
    .filter((message) => message.role === "user" && message.createdAt > sinceTimestamp);

  return { answered, interventions, userMessages };
}

function buildSignalDigest(args: {
  answered: Array<{ id: string; question: string; answer: string | null }>;
  interventions: Array<{ id: string; workerId: string | null; interventionType: string; prompt: string }>;
  userMessages: Array<{ id: string; content: string }>;
  outcomeSummary?: string;
  trigger: ConsolidationTrigger;
}) {
  const blocks: string[] = [];

  if (args.outcomeSummary) {
    blocks.push(`Run outcome (${args.trigger}): ${args.outcomeSummary}`);
  }

  if (args.answered.length) {
    blocks.push("Answered clarifications since last consolidation:");
    for (const clarification of args.answered) {
      blocks.push(`- id=${clarification.id} Q: ${truncate(clarification.question, 600)}`);
      blocks.push(`  A: ${truncate(clarification.answer ?? "", 800)}`);
    }
  }

  if (args.interventions.length) {
    blocks.push("Supervisor interventions since last consolidation:");
    for (const intervention of args.interventions) {
      blocks.push(`- id=${intervention.id} type=${intervention.interventionType} worker=${intervention.workerId ?? "n/a"}`);
      blocks.push(`  prompt: ${truncate(intervention.prompt, 600)}`);
    }
  }

  if (args.userMessages.length) {
    blocks.push("User messages since last consolidation:");
    for (const message of args.userMessages) {
      blocks.push(`- id=${message.id}: ${truncate(message.content, 800)}`);
    }
  }

  return truncate(blocks.join("\n"), MAX_INPUT_CHARS);
}

function buildExistingMemorySnapshot(projectPath: string) {
  try {
    const files = listMemory(projectPath).slice(0, 12);
    const blocks: string[] = ["Current memory files (existing content for dedup):"];
    for (const file of files) {
      try {
        const read = readMemory(projectPath, file.path, { maxBytes: 4_000 });
        blocks.push(`# ${file.path}`);
        blocks.push(read.content);
        blocks.push("");
      } catch {
        // skip unreadable
      }
    }
    return blocks.join("\n");
  } catch {
    return "Current memory files: (unavailable)";
  }
}

const CONSOLIDATION_SYSTEM_PROMPT = `You extract durable project-level lessons from a supervisor run and emit memory file operations under .omniharness/memory/.

Rules:
- Output ONLY a JSON array of operations. No prose, no markdown fences, no commentary.
- Operation shape: {"op": "append" | "write" | "noop", "path": string, "content": string, "reason": string, "evidenceIds"?: string[]}
- Only durable, project-scoped lessons: conventions, decisions, gotchas, verification commands, unresolved questions, reusable lessons. Skip transient task chatter, raw logs, secrets, or per-run progress that would be obvious from reading the repository.
- Each operation MUST cite evidence in the "reason" field (which clarification/intervention/user-message it came from, by id or quoted snippet). Include evidenceIds when available.
- Prefer "append" with a dated bullet ("- YYYY-MM-DD: <lesson>"). Reserve "write" only for replacing clearly stale sections that are explicitly contradicted.
- If a lesson is already in memory, emit {"op": "noop", ...} with a reason citing the existing entry. Do not duplicate.
- Suggested filenames: overview.md, project-conventions.md, decisions.md, gotchas.md, open-questions.md, verification.md. Use existing files when relevant; create new files only when no existing file fits.
- Cap: at most 8 operations. Each content payload at most 1500 characters.
- If nothing durable is worth saving, return an empty array: []`;

function buildUserPrompt(args: {
  signalDigest: string;
  existingMemorySnapshot: string;
  trigger: ConsolidationTrigger;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Today's date: ${today}`,
    `Trigger: ${args.trigger}`,
    "",
    args.existingMemorySnapshot,
    "",
    "Signals to extract durable lessons from:",
    args.signalDigest,
    "",
    "Return the JSON array of operations.",
  ].join("\n");
}

function parseConsolidationPlan(raw: string): ConsolidationOperation[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    text = text.slice(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Consolidation output is not a JSON array.");
  }

  const operations: ConsolidationOperation[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const op = candidate.op;
    if (op !== "append" && op !== "write" && op !== "noop") {
      continue;
    }
    const pathValue = typeof candidate.path === "string" ? candidate.path.trim() : "";
    const content = typeof candidate.content === "string" ? candidate.content : "";
    const reason = typeof candidate.reason === "string" ? candidate.reason : "";
    if (!pathValue || !reason) {
      continue;
    }
    if (op !== "noop" && content.length === 0) {
      continue;
    }
    if (content.length > MAX_OP_CONTENT_CHARS) {
      continue;
    }
    const evidenceIds = Array.isArray(candidate.evidenceIds)
      ? candidate.evidenceIds.filter((id): id is string => typeof id === "string")
      : undefined;
    operations.push({ op, path: pathValue, content, reason, evidenceIds });
    if (operations.length >= MAX_OPERATIONS) {
      break;
    }
  }
  return operations;
}

async function loadEnv() {
  const allSettings = await db.select().from(settings);
  const { env } = hydrateRuntimeEnvFromSettings(allSettings);
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

async function recordSkipped(runId: string, trigger: ConsolidationTrigger, reason: string) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: null,
    planItemId: null,
    eventType: "supervisor_memory_consolidation_skipped",
    details: JSON.stringify({
      summary: `Memory consolidation skipped (${reason}).`,
      trigger,
      reason,
    }),
    createdAt: new Date(),
  });
}

async function recordConsolidated(runId: string, args: {
  trigger: ConsolidationTrigger;
  model: string;
  provider: string;
  operations: ConsolidationOperation[];
}) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: null,
    planItemId: null,
    eventType: "supervisor_memory_consolidated",
    details: JSON.stringify({
      summary: `Consolidated project memory (${args.trigger}): ${args.operations.length} operation(s).`,
      trigger: args.trigger,
      model: args.model,
      provider: args.provider,
      operationCount: args.operations.length,
      operations: args.operations,
    }),
    createdAt: new Date(),
  });
}

async function bumpMemoryRevision(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return;
  }
  await db.update(runs).set({
    memoryMetadataRevision: (run.memoryMetadataRevision ?? 0) + 1,
    updatedAt: new Date(),
  }).where(eq(runs.id, runId));
}

export async function consolidateProjectMemory(args: {
  runId: string;
  trigger: ConsolidationTrigger;
  outcomeSummary?: string;
}): Promise<ConsolidationResult> {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) {
    return { skipped: true, reason: "run_not_found", operations: 0 };
  }
  if (!run.projectPath) {
    await recordSkipped(args.runId, args.trigger, "no_project_path");
    return { skipped: true, reason: "no_project_path", operations: 0 };
  }
  if (args.trigger === "failure" && isInfraFailure(args.outcomeSummary)) {
    await recordSkipped(args.runId, args.trigger, "infra_failure");
    return { skipped: true, reason: "infra_failure", operations: 0 };
  }

  const lastConsolidationAt = run.lastMemoryConsolidationAt ?? null;
  if (args.trigger === "compaction" && lastConsolidationAt) {
    const elapsed = Date.now() - lastConsolidationAt.getTime();
    if (elapsed < MIN_CONSOLIDATION_INTERVAL_MS) {
      await recordSkipped(args.runId, args.trigger, "interval_throttled");
      return { skipped: true, reason: "interval_throttled", operations: 0 };
    }
  }

  const sinceTimestamp = lastConsolidationAt ?? run.createdAt;
  const signals = await gatherSignals(args.runId, sinceTimestamp);

  const hasSignals = signals.answered.length > 0
    || signals.interventions.length > 0
    || signals.userMessages.length > 0;

  if (!hasSignals) {
    // Quietly skip when there is nothing to learn from. No event emitted to
    // keep the run timeline clean — consolidation is opportunistic by design.
    return { skipped: true, reason: "no_signal", operations: 0 };
  }

  await loadEnv();
  const llmConfig = getSupervisorModelConfig(process.env, "fallback");
  try {
    validateSupervisorModelConfig(llmConfig, []);
  } catch (error) {
    await recordSkipped(args.runId, args.trigger, "model_unavailable");
    throw error;
  }

  const signalDigest = buildSignalDigest({
    answered: signals.answered.map((row) => ({ id: row.id, question: row.question, answer: row.answer })),
    interventions: signals.interventions.map((row) => ({
      id: row.id,
      workerId: row.workerId,
      interventionType: row.interventionType,
      prompt: row.prompt,
    })),
    userMessages: signals.userMessages.map((row) => ({ id: row.id, content: row.content })),
    outcomeSummary: args.outcomeSummary,
    trigger: args.trigger,
  });

  const existingMemorySnapshot = buildExistingMemorySnapshot(run.projectPath);
  const userPrompt = buildUserPrompt({
    signalDigest,
    existingMemorySnapshot,
    trigger: args.trigger,
  });

  const agent = new Agent({
    id: "omniharness-memory-consolidator",
    name: "OmniHarness Memory Consolidator",
    instructions: CONSOLIDATION_SYSTEM_PROMPT,
    model: buildMastraModelConfig(llmConfig),
    tools: {},
  });

  let rawOutput: string;
  try {
    const completion = await agent.generate(
      [
        { role: "system" as const, content: CONSOLIDATION_SYSTEM_PROMPT },
        { role: "user" as const, content: userPrompt },
      ],
      { maxSteps: 1 },
    );
    rawOutput = typeof completion.text === "string" ? completion.text : "";
  } catch (error) {
    await recordSkipped(args.runId, args.trigger, "model_call_failed");
    throw error;
  }

  let plan: ConsolidationOperation[];
  try {
    plan = parseConsolidationPlan(rawOutput);
  } catch (error) {
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId: args.runId,
      workerId: null,
      planItemId: null,
      eventType: "supervisor_memory_consolidation_failed",
      details: JSON.stringify({
        summary: "Memory consolidation produced unparseable output.",
        trigger: args.trigger,
        rawOutput: truncate(rawOutput, 4_000),
        error: error instanceof Error ? error.message : String(error),
      }),
      createdAt: new Date(),
    });
    await db.update(runs).set({
      lastMemoryConsolidationAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(runs.id, args.runId));
    return { skipped: true, reason: "unparseable_output", operations: 0 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const provenance = `<!-- supervisor:run=${args.runId} trigger=${args.trigger} date=${today} -->`;
  let applied = 0;
  for (const operation of plan) {
    if (operation.op === "noop") {
      continue;
    }
    try {
      const provenancedContent = operation.op === "append"
        ? `${operation.content.trim()}\n${provenance}\n`
        : operation.content;
      if (operation.op === "append") {
        appendMemory(run.projectPath, operation.path, provenancedContent);
      } else {
        writeMemory(run.projectPath, operation.path, provenancedContent);
      }
      applied += 1;
    } catch (operationError) {
      await db.insert(executionEvents).values({
        id: randomUUID(),
        runId: args.runId,
        workerId: null,
        planItemId: null,
        eventType: "supervisor_memory_consolidation_failed",
        details: JSON.stringify({
          summary: `Memory consolidation operation failed for ${operation.path}.`,
          trigger: args.trigger,
          operation,
          error: operationError instanceof Error ? operationError.message : String(operationError),
        }),
        createdAt: new Date(),
      });
    }
  }

  await recordConsolidated(args.runId, {
    trigger: args.trigger,
    model: llmConfig.model,
    provider: llmConfig.provider,
    operations: plan,
  });

  await db.update(runs).set({
    lastMemoryConsolidationAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));

  if (applied > 0) {
    await bumpMemoryRevision(args.runId);
  }

  return { skipped: false, operations: applied, plan };
}
