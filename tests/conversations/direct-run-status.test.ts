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
  directWorkerOutputRequestsUserInput,
  updateDirectRunStatusFromWorkerOutput,
} from "@/server/conversations/direct-run-status";

describe("directWorkerOutputRequestsUserInput", () => {
  beforeEach(async () => {
    mockRunMilestoneAutoCommit.mockReset();
    await db.delete(runs);
    await db.delete(plans);
  });

  it("does not treat quoted product copy as a request for user input", () => {
    expect(directWorkerOutputRequestsUserInput({
      currentText: "I replaced the empty-state heading with a translated \"What shall we build, Network School?\" line and the logo above it.",
    })).toBe(false);
  });

  it("detects explicit requests for user direction", () => {
    expect(directWorkerOutputRequestsUserInput({
      currentText: "Before I proceed, please confirm which approach you want.",
    })).toBe(true);
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
