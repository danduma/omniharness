import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const supervisorObserverSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/supervisor/observer.ts"),
  "utf8",
);
const supervisorContextSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/supervisor/context.ts"),
  "utf8",
);
const supervisorIndexSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/supervisor/index.ts"),
  "utf8",
);
const handoffRequestSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/handoff/request.ts"),
  "utf8",
);
const queuedMessagesSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/conversations/queued-messages.ts"),
  "utf8",
);
const sendMessageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/conversations/send-message.ts"),
  "utf8",
);
const recoveryActionsSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/runs/recovery-actions.ts"),
  "utf8",
);
const recoveryReconcilerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/runs/recovery-reconciler.ts"),
  "utf8",
);
const omniAcpSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/omni-acp/agent.ts"),
  "utf8",
);
const cliRunnerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/cli/runner.ts"),
  "utf8",
);
const executionEventStoreSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/events/execution-event-store.ts"),
  "utf8",
);
const messagesRouteSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/runtime/http/routes/messages.ts"),
  "utf8",
);
const planningPromoteSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/planning/promote.ts"),
  "utf8",
);
const runRecoverySource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/runs/recovery.ts"),
  "utf8",
);
const quotaTypeBlockingSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/quota/type-blocking.ts"),
  "utf8",
);
const recoveryUtilsSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/recovery-utils.ts"),
  "utf8",
);
const snapshotCacheManagerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/EventStreamSnapshotCacheManager.ts"),
  "utf8",
);

describe("supervisor deterministic ordering guards", () => {
  it("uses id tie-breakers for timestamp-ordered supervisor event reads", () => {
    expect(supervisorObserverSource).toContain("orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(25)");
    // execution_events full-history ordering moved into the
    // `execution-event-store` adapter when append-only artifact
    // storage landed. Assert the deterministic ordering still lives
    // there; the supervisor surfaces now consume the adapter result.
    expect(executionEventStoreSource).toContain("orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))");
    expect(executionEventStoreSource).toContain("orderBy(asc(executionEvents.createdAt), asc(executionEvents.id))");
  });

  it("uses stable in-memory tie-breakers for supervisor context rows", () => {
    expect(supervisorContextSource).toContain("compareByCreatedAtThenId(a, b)");
    expect(supervisorIndexSource).toContain("compareByCreatedAtThenId(b, a)");
  });

  it("uses id tie-breakers for non-supervisor latest and replay reads", () => {
    // execution_events reads moved into the adapter — see the
    // `listExecutionEventsForWorker`/`listExecutionEventsForRun`/
    // `listExecutionEventsForSnapshot` queries in execution-event-store.
    expect(executionEventStoreSource).toContain("orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))");
    expect(executionEventStoreSource).toContain("orderBy(asc(executionEvents.createdAt), asc(executionEvents.id))");
    expect(handoffRequestSource).toContain("orderBy(desc(messages.createdAt), desc(messages.id))");
    expect(queuedMessagesSource).toContain("orderBy(desc(workers.createdAt), desc(workers.id))");
    expect(queuedMessagesSource).toContain("orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))");
    expect(sendMessageSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(sendMessageSource).toContain("orderBy(asc(clarifications.createdAt), asc(clarifications.id))");
    expect(recoveryActionsSource).toContain("orderBy(desc(messages.createdAt), desc(messages.id))");
    expect(recoveryActionsSource).toContain("orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))");
    expect(recoveryReconcilerSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(recoveryReconcilerSource).toContain("orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))");
    expect(omniAcpSource).toContain("orderBy(desc(runs.updatedAt), desc(runs.id))");
    expect(messagesRouteSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(planningPromoteSource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(runRecoverySource).toContain("orderBy(desc(messages.createdAt), desc(messages.id))");
    expect(runRecoverySource).toContain("orderBy(asc(messages.createdAt), asc(messages.id))");
    expect(quotaTypeBlockingSource).toContain("return updatedDelta !== 0 ? updatedDelta : b.id.localeCompare(a.id);");
    expect(recoveryUtilsSource).toContain("return updatedDelta !== 0 ? updatedDelta : b.id.localeCompare(a.id);");
    expect(snapshotCacheManagerSource).toContain("return updatedDelta !== 0 ? updatedDelta : left[0].localeCompare(right[0]);");
  });
});
