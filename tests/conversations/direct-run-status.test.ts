import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
