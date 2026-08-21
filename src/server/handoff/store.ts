import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { appendArtifactLine, readAllArtifactEntries, resolveArtifactStreamLocation } from "@/server/artifacts/append-only-store";
import { commitArtifactAppend, ensureArtifactStreamRow, readArtifactStreamMetadata, reserveNextArtifactSeq } from "@/server/artifacts/stream-metadata";
import type { ArtifactRecordEnvelope } from "@/server/artifacts/stream-types";
import { db } from "@/server/db";
import { conversationHandoffs, queuedConversationMessages, runs } from "@/server/db/schema";
import type {
  HandoffReason,
  HandoffRecordDto,
  HandoffStatus,
  HandoffTargetSelection,
  HybridHandoffPacketV1,
} from "@/shared/handoff";
import { HANDOFF_READY_MAX_LIFETIME_MS, HANDOFF_STREAM_SETTLE_TIMEOUT_MS } from "@/shared/handoff";

const ACTIVE_STATUSES: HandoffStatus[] = ["capturing", "ready", "launching", "needs_recovery"];
const EXPIRABLE_STATUSES: HandoffStatus[] = ["capturing", "ready", "launching"];
const packetWriteChains = new Map<string, Promise<void>>();

async function withPacketWriteLock<T>(handoffId: string, task: () => Promise<T>): Promise<T> {
  const previous = packetWriteChains.get(handoffId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const chain = previous.then(() => gate);
  packetWriteChains.set(handoffId, chain);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (packetWriteChains.get(handoffId) === chain) packetWriteChains.delete(handoffId);
  }
}

export class HandoffStoreError extends Error {
  constructor(readonly code: "handoff_not_found" | "handoff_revision_conflict" | "handoff_invalid_transition" | "handoff_packet_corrupt" | "handoff_packet_version_unsupported", message: string) {
    super(message);
    this.name = "HandoffStoreError";
  }
}

type HandoffRow = typeof conversationHandoffs.$inferSelect;

function targetFromRow(row: HandoffRow): HandoffTargetSelection {
  return {
    workerType: row.targetWorkerType as HandoffTargetSelection["workerType"],
    model: row.targetModel,
    effort: row.targetEffort,
    accountId: row.targetAccountId,
  };
}

async function readPacket(row: HandoffRow): Promise<HybridHandoffPacketV1 | null> {
  if (row.artifactSeq == null || row.packetVersion == null) return null;
  const metadata = await readArtifactStreamMetadata({ runId: row.sourceRunId, kind: "handoff_packets", ownerId: null });
  if (!metadata) return null;
  const location = await resolveArtifactStreamLocation({
    runId: row.sourceRunId,
    kind: "handoff_packets",
    ownerId: null,
    projectPath: metadata.projectPath,
  }, "read");
  const entries = await readAllArtifactEntries<ArtifactRecordEnvelope<HybridHandoffPacketV1>>(location);
  const entry = entries.find((candidate) => (
    candidate.seq === row.artifactSeq
    && candidate.runId === row.sourceRunId
    && candidate.kind === "handoff_packets"
    && candidate.payload?.contentHash === row.packetHash
  ));
  if (!entry) throw new HandoffStoreError("handoff_packet_corrupt", "The persisted handoff packet is missing or does not match its metadata.");
  if (row.packetVersion !== 1 || entry.payload.handoffVersion !== 1) {
    throw new HandoffStoreError("handoff_packet_version_unsupported", `Unsupported handoff packet version ${row.packetVersion}.`);
  }
  return entry.payload;
}

async function toDto(row: HandoffRow): Promise<HandoffRecordDto> {
  return {
    id: row.id,
    sourceRunId: row.sourceRunId,
    sourceWorkerId: row.sourceWorkerId,
    targetRunId: row.targetRunId,
    forkedFromMessageId: row.forkedFromMessageId,
    reason: row.reason as HandoffReason,
    status: row.status as HandoffStatus,
    revision: row.revision,
    sourceSeq: row.sourceSeq,
    workspaceFingerprint: row.workspaceFingerprint,
    operationId: row.operationId,
    target: targetFromRow(row),
    packet: await readPacket(row),
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createHandoffDraft(args: {
  id?: string;
  sourceRunId: string;
  sourceWorkerId: string | null;
  forkedFromMessageId: string | null;
  normalizedProjectPath: string;
  reason: HandoffReason;
  target: HandoffTargetSelection;
  targetSelectionHash: string;
  retryOfHandoffId?: string | null;
  claimExpiresAt?: Date | null;
}): Promise<HandoffRecordDto> {
  const existing = await db.select().from(conversationHandoffs)
    .where(and(eq(conversationHandoffs.sourceRunId, args.sourceRunId), inArray(conversationHandoffs.status, ACTIVE_STATUSES)))
    .orderBy(desc(conversationHandoffs.updatedAt), desc(conversationHandoffs.id))
    .limit(1)
    .get();
  if (existing) {
    if (existing.targetSelectionHash === args.targetSelectionHash && existing.reason === args.reason && existing.forkedFromMessageId === args.forkedFromMessageId) return toDto(existing);
    throw new HandoffStoreError("handoff_invalid_transition", "A different handoff is already active for this conversation.");
  }
  const now = new Date();
  const id = args.id ?? randomUUID();
  await db.insert(conversationHandoffs).values({
    id,
    sourceRunId: args.sourceRunId,
    sourceWorkerId: args.sourceWorkerId,
    forkedFromMessageId: args.forkedFromMessageId,
    reason: args.reason,
    status: "capturing",
    revision: 1,
    normalizedProjectPath: args.normalizedProjectPath,
    targetWorkerType: args.target.workerType,
    targetModel: args.target.model,
    targetEffort: args.target.effort,
    targetAccountId: args.target.accountId,
    targetSelectionHash: args.targetSelectionHash,
    retryOfHandoffId: args.retryOfHandoffId ?? null,
    claimExpiresAt: args.claimExpiresAt ?? new Date(Date.now() + 15 * 60 * 1_000),
    createdAt: now,
    updatedAt: now,
  });
  await db.update(runs).set({ activeHandoffId: id, updatedAt: now }).where(eq(runs.id, args.sourceRunId));
  return (await getHandoffById(id))!;
}

export async function getHandoffById(id: string): Promise<HandoffRecordDto | null> {
  const row = await db.select().from(conversationHandoffs).where(eq(conversationHandoffs.id, id)).get();
  return row ? toDto(row) : null;
}

export async function getActiveHandoffForRun(sourceRunId: string): Promise<HandoffRecordDto | null> {
  const row = await db.select().from(conversationHandoffs)
    .where(and(eq(conversationHandoffs.sourceRunId, sourceRunId), inArray(conversationHandoffs.status, ACTIVE_STATUSES)))
    .orderBy(desc(conversationHandoffs.updatedAt), desc(conversationHandoffs.id))
    .limit(1)
    .get();
  return row ? toDto(row) : null;
}

export async function saveHandoffPacket(args: {
  handoffId: string;
  expectedRevision: number;
  packet: HybridHandoffPacketV1;
  workspaceFingerprint: string | null;
  sourceWorkerId?: string | null;
  sourceSeq?: number | null;
  claimExpiresAt?: Date | null;
}): Promise<HandoffRecordDto> {
  return withPacketWriteLock(args.handoffId, () => saveHandoffPacketUnlocked(args));
}

async function saveHandoffPacketUnlocked(args: {
  handoffId: string;
  expectedRevision: number;
  packet: HybridHandoffPacketV1;
  workspaceFingerprint: string | null;
  sourceWorkerId?: string | null;
  sourceSeq?: number | null;
  claimExpiresAt?: Date | null;
}): Promise<HandoffRecordDto> {
  const row = await db.select().from(conversationHandoffs).where(eq(conversationHandoffs.id, args.handoffId)).get();
  if (!row) throw new HandoffStoreError("handoff_not_found", "Handoff not found.");
  if (row.revision !== args.expectedRevision) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision is stale.");
  if (row.status !== "capturing" && row.status !== "ready") throw new HandoffStoreError("handoff_invalid_transition", `Cannot save a packet while handoff is ${row.status}.`);
  const now = new Date();
  const claimedRevision = args.expectedRevision + 1;
  const claim = await db.update(conversationHandoffs).set({
    status: "capturing",
    revision: claimedRevision,
    claimExpiresAt: new Date(now.getTime() + HANDOFF_STREAM_SETTLE_TIMEOUT_MS),
    updatedAt: now,
  }).where(and(
    eq(conversationHandoffs.id, row.id),
    eq(conversationHandoffs.revision, args.expectedRevision),
    eq(conversationHandoffs.status, row.status),
  ));
  if (claim.rowsAffected !== 1) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision changed before the packet write was claimed.");
  let seq: number | null = null;
  try {
    const { location } = await ensureArtifactStreamRow({ runId: row.sourceRunId, kind: "handoff_packets", ownerId: null });
    seq = await reserveNextArtifactSeq({ runId: row.sourceRunId, kind: "handoff_packets", ownerId: null });
    const recordId = `${row.id}:${claimedRevision}`;
    const envelope: ArtifactRecordEnvelope<HybridHandoffPacketV1> = {
      id: recordId,
      seq,
      runId: row.sourceRunId,
      kind: "handoff_packets",
      createdAt: new Date().toISOString(),
      payload: args.packet,
    };
    await appendArtifactLine(location, JSON.stringify(envelope), { seq });
    await commitArtifactAppend({ streamId: { runId: row.sourceRunId, kind: "handoff_packets", ownerId: null }, seq, recordId });
  } catch (error) {
    await transitionHandoff({ handoffId: row.id, expectedRevision: claimedRevision, from: ["capturing"], to: "failed", lastError: `handoff_packet_write_failed: ${error instanceof Error ? error.message : String(error)}` }).catch(() => undefined);
    throw error;
  }
  const readyExpiryCap = new Date(row.createdAt.getTime() + HANDOFF_READY_MAX_LIFETIME_MS);
  const requestedExpiry = args.claimExpiresAt ?? readyExpiryCap;
  const result = await db.update(conversationHandoffs).set({
    status: "ready",
    sourceWorkerId: args.sourceWorkerId === undefined ? row.sourceWorkerId : args.sourceWorkerId,
    sourceSeq: args.sourceSeq ?? args.packet.source.sourceSeq,
    workspaceFingerprint: args.workspaceFingerprint,
    packetVersion: args.packet.handoffVersion,
    artifactSeq: seq,
    packetHash: args.packet.contentHash,
    packetPreview: JSON.stringify({ task: args.packet.task, state: args.packet.state, provenance: args.packet.provenance }).slice(0, 8_000),
    summarySource: args.packet.provenance.summarySource,
    claimExpiresAt: requestedExpiry.getTime() < readyExpiryCap.getTime() ? requestedExpiry : readyExpiryCap,
    updatedAt: now,
  }).where(and(
    eq(conversationHandoffs.id, row.id),
    eq(conversationHandoffs.revision, claimedRevision),
    eq(conversationHandoffs.status, "capturing"),
  ));
  if (result.rowsAffected !== 1) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision changed while the packet was saved.");
  return (await getHandoffById(row.id))!;
}

export async function transitionHandoff(args: {
  handoffId: string;
  expectedRevision: number;
  from: HandoffStatus[];
  to: HandoffStatus;
  targetRunId?: string | null;
  operationId?: string | null;
  launchClaimToken?: string | null;
  claimExpiresAt?: Date | null;
  lastError?: string | null;
}): Promise<HandoffRecordDto> {
  const row = await db.select().from(conversationHandoffs).where(eq(conversationHandoffs.id, args.handoffId)).get();
  if (!row) throw new HandoffStoreError("handoff_not_found", "Handoff not found.");
  if (row.revision !== args.expectedRevision) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision is stale.");
  const graph: Record<HandoffStatus, HandoffStatus[]> = {
    capturing: ["ready", "failed", "cancelled"],
    ready: ["launching", "failed", "cancelled"],
    launching: ["completed", "needs_recovery", "failed"],
    needs_recovery: ["failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  if (!args.from.includes(row.status as HandoffStatus) || !graph[row.status as HandoffStatus].includes(args.to)) {
    throw new HandoffStoreError("handoff_invalid_transition", `Cannot transition ${row.status} to ${args.to}.`);
  }
  const terminal = args.to === "completed" || args.to === "failed" || args.to === "cancelled";
  const now = new Date();
  await db.transaction(async (tx) => {
    const result = await tx.update(conversationHandoffs).set({
      status: args.to,
      revision: row.revision + 1,
      targetRunId: args.targetRunId === undefined ? row.targetRunId : args.targetRunId,
      operationId: args.operationId === undefined ? row.operationId : args.operationId,
      launchClaimToken: args.launchClaimToken === undefined ? row.launchClaimToken : args.launchClaimToken,
      claimExpiresAt: args.claimExpiresAt === undefined ? row.claimExpiresAt : args.claimExpiresAt,
      lastError: args.lastError === undefined ? row.lastError : args.lastError,
      completedAt: terminal ? now : null,
      updatedAt: now,
    }).where(and(eq(conversationHandoffs.id, row.id), eq(conversationHandoffs.revision, args.expectedRevision), eq(conversationHandoffs.status, row.status)));
    if (result.rowsAffected !== 1) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision changed during transition.");
    if (terminal) await tx.update(runs).set({ activeHandoffId: null, updatedAt: now }).where(eq(runs.id, row.sourceRunId));
  });
  return (await getHandoffById(row.id))!;
}

export async function completeHandoffLaunch(args: {
  handoffId: string;
  expectedRevision: number;
  sourceRunId: string;
  targetRunId: string;
}): Promise<HandoffRecordDto> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const result = await tx.update(conversationHandoffs).set({
      status: "completed",
      revision: args.expectedRevision + 1,
      targetRunId: args.targetRunId,
      completedAt: now,
      updatedAt: now,
    }).where(and(
      eq(conversationHandoffs.id, args.handoffId),
      eq(conversationHandoffs.sourceRunId, args.sourceRunId),
      eq(conversationHandoffs.revision, args.expectedRevision),
      eq(conversationHandoffs.status, "launching"),
    ));
    if (result.rowsAffected !== 1) throw new HandoffStoreError("handoff_revision_conflict", "Handoff revision changed during completion.");
    await tx.update(runs).set({ status: "cancelled", activeHandoffId: null, updatedAt: now }).where(eq(runs.id, args.sourceRunId));
    await tx.update(queuedConversationMessages).set({ status: "cancelled", lastError: "cross_cli_handoff", updatedAt: now }).where(and(
      eq(queuedConversationMessages.runId, args.sourceRunId),
      inArray(queuedConversationMessages.status, ["pending", "delivering"]),
    ));
  });
  return (await getHandoffById(args.handoffId))!;
}

export async function listExpiredHandoffs(now = new Date()): Promise<HandoffRecordDto[]> {
  const rows = await db.select().from(conversationHandoffs)
    .where(and(inArray(conversationHandoffs.status, EXPIRABLE_STATUSES), lt(conversationHandoffs.claimExpiresAt, now)))
    .orderBy(conversationHandoffs.claimExpiresAt, conversationHandoffs.id);
  return Promise.all(rows.map(toDto));
}
