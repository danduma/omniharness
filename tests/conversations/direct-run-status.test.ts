import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";

const { mockRunMilestoneAutoCommit } = vi.hoisted(() => ({
  mockRunMilestoneAutoCommit: vi.fn(),
}));

vi.mock("@/server/git/run-auto-commit", () => ({
  runMilestoneAutoCommit: mockRunMilestoneAutoCommit,
}));

import {
  directWorkerOutputHasPendingHumanInput,
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "@/server/conversations/direct-run-status";

describe("directWorkerOutputHasPendingHumanInput", () => {
  beforeEach(async () => {
    mockRunMilestoneAutoCommit.mockReset();
    await db.delete(runs);
    await db.delete(plans);
  });

  it("does not treat quoted product copy as a request for user input", () => {
    expect(directWorkerOutputHasPendingHumanInput({
      currentText: "I replaced the empty-state heading with a translated \"What shall we build, Network School?\" line and the logo above it.",
    })).toBe(false);
  });

  it("does not infer pending input from prose requests", () => {
    expect(directWorkerOutputHasPendingHumanInput({
      currentText: "Before I proceed, please confirm which approach you want.",
    })).toBe(false);
  });

  it("does not treat optional post-completion follow-up as blocking input", () => {
    expect(directWorkerOutputHasPendingHumanInput({
      currentText: [
        "Done. The modified files are grouped into three logical commits and pushed to `origin/master`.",
        "Let me know if you actually want either committed or added to `.gitignore`.",
      ].join("\n"),
    })).toBe(false);
  });

  it("detects structured pending human input only", () => {
    expect(directWorkerOutputHasPendingHumanInput({
      outputEntries: [
        { type: "elicitation", status: "pending", text: "Question for user" },
      ],
    })).toBe(true);
    expect(directWorkerOutputHasPendingHumanInput({
      outputEntries: [
        { type: "permission", status: "pending", text: "Permission requested", raw: { requestId: 64 } },
        { type: "permission", status: "approved", text: "Permission approved", raw: { requestId: 64 } },
      ],
    })).toBe(false);
    expect(directWorkerOutputHasPendingHumanInput({
      outputEntries: [
        { type: "permission", status: "approved", text: "Permission approved" },
      ],
    })).toBe(false);
    expect(directWorkerOutputHasPendingHumanInput({
      pendingElicitations: [{ requestId: 1 }],
    })).toBe(true);
  });

  it("parks a quota-blocked worker instead of marking the conversation done", () => {
    // Regression: `cred-exhausted` is idle but not finished. Falling through to
    // "done" cleared the run out of `quota_waiting`, which dropped the "waiting
    // for quota reset" banner and left the conversation looking complete while
    // it was actually blocked on the provider window.
    expect(resolveDirectRunStatusFromWorkerOutput({
      workerStatus: "cred-exhausted",
      lastText: "You've hit your session limit · resets 4pm (Europe/Madrid)",
    })).toBe("quota_waiting");
  });

  it("still surfaces pending human input ahead of a quota block", () => {
    expect(resolveDirectRunStatusFromWorkerOutput({
      workerStatus: "cred-exhausted",
      pendingElicitations: [{ requestId: 1 }],
    })).toBe("awaiting_user");
  });

  it("keeps active direct workers running after structured input is answered", () => {
    expect(resolveDirectRunStatusFromWorkerOutput({
      workerStatus: "working",
      outputEntries: [
        {
          type: "elicitation",
          status: "pending",
          text: "Question for user",
          raw: { requestId: 2 },
        },
        {
          type: "elicitation",
          status: "answered",
          text: "Question answered",
          raw: { requestId: 2 },
        },
        {
          type: "tool_call",
          status: "pending",
          text: "Read File",
        },
      ],
    })).toBe("running");
  });

  it("keeps an idle direct worker awaiting a blocking prose decision", () => {
    expect(resolveDirectRunStatusFromWorkerOutput({
      workerStatus: "idle",
      outputEntries: [{
        type: "message",
        text: [
          "Before merging, I need your decision.",
          "Should I commit, stash, or merge only committed changes?",
          "Which approach do you want?",
        ].join("\n"),
      }],
    })).toBe("awaiting_user");
  });

  it("completes an idle direct worker after an optional post-completion offer", () => {
    expect(resolveDirectRunStatusFromWorkerOutput({
      workerStatus: "idle",
      outputEntries: [
        {
          type: "message",
          text: "Both fixes are in, and the focused tests pass.",
        },
        {
          type: "message",
          text: " a restart, cancel and resend in the UI. Want me to restart the runner?",
        },
      ],
    })).toBe("done");
  });

  it("runs milestone auto-commit when a direct run finishes", async () => {
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-direct-auto-commit",
      path: "vibes/ad-hoc/direct-auto-commit.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-direct-auto-commit",
      planId: "plan-direct-auto-commit",
      mode: "direct",
      projectPath: "/workspace/app",
      title: "Direct change",
      status: "running",
      autoCommitMilestones: true,
      pushOnCommit: true,
      gitBaselineJson: JSON.stringify({ status: "not_git", reason: "test baseline" }),
      createdAt: now,
      updatedAt: now,
    });

    await updateDirectRunStatusFromWorkerOutput({
      runId: "run-direct-auto-commit",
      workerId: "worker-1",
      responseText: "Done.",
    });

    expect(mockRunMilestoneAutoCommit).toHaveBeenCalledWith("run-direct-auto-commit", "Done.");
  });

  it("preserves the run activity timestamp when repeated input observations do not change state", async () => {
    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
    await db.insert(plans).values({
      id: "plan-direct-awaiting-noop",
      path: "vibes/ad-hoc/direct-awaiting-noop.md",
      status: "running",
      createdAt: originalUpdatedAt,
      updatedAt: originalUpdatedAt,
    });
    await db.insert(runs).values({
      id: "run-direct-awaiting-noop",
      planId: "plan-direct-awaiting-noop",
      mode: "direct",
      title: "Direct awaiting no-op",
      status: "awaiting_user",
      createdAt: originalUpdatedAt,
      updatedAt: originalUpdatedAt,
    });

    await updateDirectRunStatusFromWorkerOutput({
      runId: "run-direct-awaiting-noop",
      workerId: "worker-1",
      workerStatus: "working",
      pendingElicitations: [{ requestId: 2 }],
    });

    const run = await db.select().from(runs).where(eq(runs.id, "run-direct-awaiting-noop")).get();
    expect(run?.status).toBe("awaiting_user");
    expect(run?.updatedAt).toEqual(originalUpdatedAt);
  });
});
