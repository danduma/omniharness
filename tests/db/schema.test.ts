import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";

describe("db schema", () => {
  it("defines autonomous execution tables", () => {
    expect(schema).toHaveProperty("planItems");
    expect(schema).toHaveProperty("clarifications");
    expect(schema).toHaveProperty("executionEvents");
    expect(schema).toHaveProperty("workerAssignments");
    expect(schema).toHaveProperty("supervisorInterventions");
    expect(schema).toHaveProperty("queuedConversationMessages");
    expect(schema).toHaveProperty("recoveryIncidents");
    expect(schema).toHaveProperty("supervisorScheduledWakes");
  });

  it("persists durable worker terminal snapshots", () => {
    expect(schema).toHaveProperty("workerCounters");
    expect(schema.workers).toHaveProperty("workerNumber");
    expect(schema.workers).toHaveProperty("outputEntriesJson");
    expect(schema.workers).toHaveProperty("currentText");
    expect(schema.workers).toHaveProperty("lastText");
  });

  it("persists structured message attachments", () => {
    expect(schema.messages).toHaveProperty("attachmentsJson");
  });

  it("persists mode-aware conversation metadata on runs", () => {
    expect(schema.runs).toHaveProperty("mode");
    expect(schema.runs).toHaveProperty("specPath");
    expect(schema.runs).toHaveProperty("artifactPlanPath");
    expect(schema.runs).toHaveProperty("plannerArtifactsJson");
    expect(schema.runs).toHaveProperty("archivedAt");
  });

  it("persists commit workflow metadata on runs", () => {
    expect(schema.runs).toHaveProperty("autoCommitMilestones");
    expect(schema.runs).toHaveProperty("pushOnCommit");
    expect(schema.runs).toHaveProperty("gitBaselineJson");
    expect(schema.runs).toHaveProperty("completionCommitSha");
  });

  it("persists immutable git workspace launch snapshots on runs", () => {
    expect(schema.runs).toHaveProperty("gitWorkspaceJson");
  });
});
