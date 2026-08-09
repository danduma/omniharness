import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMIT_WORKER_EFFORT,
  DEFAULT_COMMIT_WORKER_MODEL,
  DEFAULT_COMMIT_WORKER_TYPE,
  GIT_COMMIT_WORKER_EFFORT_SETTING,
  GIT_COMMIT_WORKER_MODEL_SETTING,
  GIT_COMMIT_WORKER_TYPE_SETTING,
  normalizeCommitWorkerSettings,
  validateCommitWorkerSettings,
} from "@/lib/commit-workflow";

describe("commit worker settings", () => {
  it("uses deterministic defaults when settings are missing or invalid", () => {
    expect(normalizeCommitWorkerSettings({})).toEqual({
      workerType: DEFAULT_COMMIT_WORKER_TYPE,
      model: DEFAULT_COMMIT_WORKER_MODEL,
      effort: DEFAULT_COMMIT_WORKER_EFFORT,
    });

    expect(normalizeCommitWorkerSettings({
      [GIT_COMMIT_WORKER_TYPE_SETTING]: "not-a-worker",
      [GIT_COMMIT_WORKER_MODEL_SETTING]: "",
      [GIT_COMMIT_WORKER_EFFORT_SETTING]: "not-an-effort",
    })).toEqual({
      workerType: DEFAULT_COMMIT_WORKER_TYPE,
      model: DEFAULT_COMMIT_WORKER_MODEL,
      effort: DEFAULT_COMMIT_WORKER_EFFORT,
    });
  });

  it("preserves an explicitly configured raw model id and normalized effort", () => {
    expect(normalizeCommitWorkerSettings({
      [GIT_COMMIT_WORKER_TYPE_SETTING]: "claude",
      [GIT_COMMIT_WORKER_MODEL_SETTING]: "custom-model-id",
      [GIT_COMMIT_WORKER_EFFORT_SETTING]: "Extra High",
    })).toEqual({
      workerType: "claude",
      model: "custom-model-id",
      effort: "extra high",
    });
  });

  it("rejects invalid settings writes without validating model catalog membership", () => {
    expect(() => validateCommitWorkerSettings({
      [GIT_COMMIT_WORKER_TYPE_SETTING]: "gemini",
      [GIT_COMMIT_WORKER_MODEL_SETTING]: "retired-model-id",
      [GIT_COMMIT_WORKER_EFFORT_SETTING]: "max",
    })).not.toThrow();

    expect(() => validateCommitWorkerSettings({
      [GIT_COMMIT_WORKER_TYPE_SETTING]: "not-a-worker",
    })).toThrow(/worker/i);

    expect(() => validateCommitWorkerSettings({
      [GIT_COMMIT_WORKER_EFFORT_SETTING]: "not-an-effort",
    })).toThrow(/effort/i);
  });
});
