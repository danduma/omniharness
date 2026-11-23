import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const handoffCandidatesSource = readSource("src/server/handoff/candidates.ts");
const queuedMessagesSource = readSource("src/server/conversations/queued-messages.ts");
const sendMessageSource = readSource("src/server/conversations/send-message.ts");
const recoveryReconcilerSource = readSource("src/server/runs/recovery-reconciler.ts");
const omniAcpSource = readSource("src/server/omni-acp/agent.ts");
const executionEventStoreSource = readSource("src/server/events/execution-event-store.ts");
const messagesRouteSource = readSource("src/runtime/http/routes/messages.ts");
const runRecoverySource = readSource("src/server/runs/recovery.ts");
const quotaTypeBlockingSource = readSource("src/server/quota/type-blocking.ts");
const recoveryUtilsSource = readSource("src/interface/home/recovery-utils.ts");
const snapshotCacheManagerSource = readSource("src/interface/home/EventStreamSnapshotCacheManager.ts");

describe("deterministic ordering guards", () => {
  it("uses id tie-breakers for timestamp-ordered execution event reads", () => {
    expect(executionEventStoreSource).toContain("orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))");
    expect(executionEventStoreSource).toContain("orderBy(asc(executionEvents.createdAt), asc(executionEvents.id))");
  });

  it("uses id tie-breakers for latest and replay reads", () => {
    expect(handoffCandidatesSource).toContain("orderBy(desc(messages.createdAt), desc(messages.id))");
    expect(handoffCandidatesSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(queuedMessagesSource).toContain("orderBy(desc(workers.createdAt), desc(workers.id))");
    expect(queuedMessagesSource).toContain("orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))");
    expect(sendMessageSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(recoveryReconcilerSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(recoveryReconcilerSource).toContain("orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))");
    expect(omniAcpSource).toContain("orderBy(desc(runs.updatedAt), desc(runs.id))");
    expect(messagesRouteSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(runRecoverySource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(quotaTypeBlockingSource).toContain("return updatedDelta !== 0 ? updatedDelta : b.id.localeCompare(a.id);");
    expect(recoveryUtilsSource).toContain("return updatedDelta !== 0 ? updatedDelta : b.id.localeCompare(a.id);");
    expect(snapshotCacheManagerSource).toContain("return updatedDelta !== 0 ? updatedDelta : left[0].localeCompare(right[0]);");
  });
});
