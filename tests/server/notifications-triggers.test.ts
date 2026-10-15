import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  clarifications,
  authEvents,
  authPairTokens,
  authSessions,
  notificationSubscriptions,
  plans,
  runs,
  settings,
} from "@/server/db/schema";

const { deliverNotificationToSubscriptions } = vi.hoisted(() => ({
  deliverNotificationToSubscriptions: vi.fn().mockResolvedValue({
    attempted: 1,
    delivered: 1,
    failed: 0,
  }),
}));

vi.mock("@/server/notifications/deliver", () => ({
  deliverNotificationToSubscriptions,
}));

import { notifyRunLifecycleEvent } from "@/server/notifications/triggers";

describe("notification lifecycle triggers", () => {
  beforeEach(async () => {
    deliverNotificationToSubscriptions.mockClear();
    await db.delete(notificationSubscriptions);
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
    await db.delete(clarifications);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  async function createRun(status: string) {
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-1",
      path: "docs/plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-1",
      planId: "plan-1",
      mode: "implementation",
      projectPath: "/repo",
      title: "Build phone notifications",
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  it("sends a push payload when a run completes", async () => {
    await createRun("done");

    await notifyRunLifecycleEvent({
      runId: "run-1",
      eventType: "run_completed",
      details: { summary: "All checks passed." },
    });

    expect(deliverNotificationToSubscriptions).toHaveBeenCalledWith({
      title: "Build phone notifications — completed",
      body: "All checks passed.",
      tag: "omniharness-run-1-complete",
      url: "/session/run-1",
    });
  });

  it("sends a push payload when a run starts waiting for input", async () => {
    await createRun("awaiting_user");

    await notifyRunLifecycleEvent({
      runId: "run-1",
      eventType: "clarification_requested",
      details: { summary: "Which deployment target?" },
    });

    expect(deliverNotificationToSubscriptions).toHaveBeenCalledWith({
      title: "Build phone notifications — answer needed",
      body: "Which deployment target?",
      tag: "omniharness-run-1-input",
      url: "/session/run-1",
    });
  });
  it("does not deliver stale completion when the run has resumed", async () => {
    await createRun("running");
    await notifyRunLifecycleEvent({ runId: "run-1", eventType: "run_completed", details: { summary: "Old result" } });
    expect(deliverNotificationToSubscriptions).not.toHaveBeenCalled();
  });

  it("shows the pending question for grouped clarification events", async () => {
    await createRun("awaiting_user");
    const now = new Date();
    await db.insert(clarifications).values({ id: "question-1", runId: "run-1", question: "Deploy to staging or production?", status: "pending", createdAt: now, updatedAt: now });
    await notifyRunLifecycleEvent({ runId: "run-1", eventType: "clarifications_requested", details: { count: 1 } });
    expect(deliverNotificationToSubscriptions).toHaveBeenCalledWith(expect.objectContaining({ body: "Deploy to staging or production?" }));
  });

});
