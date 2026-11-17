import { describe, expect, it } from "vitest";
import enLocale from "../../../shared/locales/en.json";
import {
  AGENT_ACTIVITIES,
  classifyToolActivity,
  deriveAgentActivity,
  isAttentionActivity,
} from "@/interface/office/deriveAgentActivity";

describe("deriveAgentActivity", () => {
  it("puts pending permissions and elicitations ahead of any worker status", () => {
    expect(deriveAgentActivity({ workerStatus: "working", pendingPermissionCount: 1 })).toBe("waiting_user");
    expect(deriveAgentActivity({ workerStatus: "stuck", pendingElicitationCount: 2 })).toBe("waiting_user");
  });

  it("maps persisted blocking and terminal statuses authoritatively", () => {
    expect(deriveAgentActivity({ workerStatus: "stuck", agentState: "working" })).toBe("blocked");
    expect(deriveAgentActivity({ workerStatus: "lost" })).toBe("blocked");
    expect(deriveAgentActivity({ workerStatus: "cred-exhausted", agentState: "working" })).toBe("quota_blocked");
    expect(deriveAgentActivity({ workerStatus: "error" })).toBe("errored");
    expect(deriveAgentActivity({ workerStatus: "completed", agentState: "idle" })).toBe("done");
    expect(deriveAgentActivity({ workerStatus: "canceled" })).toBe("cancelled");
    expect(deriveAgentActivity({ workerStatus: "recovering" })).toBe("recovering");
  });

  it("lets the live agent state refine a running worker", () => {
    expect(deriveAgentActivity({ workerStatus: "starting", agentState: "working" })).toBe("working");
    expect(deriveAgentActivity({ workerStatus: "working", agentState: "idle" })).toBe("idle");
    expect(deriveAgentActivity({ workerStatus: "idle", agentState: "stuck" })).toBe("blocked");
    expect(deriveAgentActivity({ workerStatus: "starting" })).toBe("starting");
  });

  it("normalizes status casing and suffixes", () => {
    expect(deriveAgentActivity({ workerStatus: " Working:turn " })).toBe("working");
    expect(deriveAgentActivity({ workerStatus: "AWAITING_USER" })).toBe("waiting_user");
  });

  it("falls back to idle for unknown or missing statuses", () => {
    expect(deriveAgentActivity({ workerStatus: null })).toBe("idle");
    expect(deriveAgentActivity({ workerStatus: "mystery" })).toBe("idle");
  });

  it("uses the latest tool call only while working", () => {
    expect(deriveAgentActivity({ workerStatus: "working", latestToolCall: { kind: "read" } })).toBe("researching");
    expect(deriveAgentActivity({ workerStatus: "idle", latestToolCall: { kind: "edit" } })).toBe("idle");
  });
});

describe("classifyToolActivity", () => {
  it("maps ACP tool kinds", () => {
    expect(classifyToolActivity({ kind: "search" })).toBe("researching");
    expect(classifyToolActivity({ kind: "fetch" })).toBe("researching");
    expect(classifyToolActivity({ kind: "edit" })).toBe("writing");
    expect(classifyToolActivity({ kind: "think" })).toBeNull();
    expect(classifyToolActivity(null)).toBeNull();
  });

  it("separates test runs from other commands", () => {
    expect(classifyToolActivity({ kind: "execute", title: "pnpm test:lifecycle" })).toBe("testing");
    expect(classifyToolActivity({ kind: "execute", title: "npx vitest run tests/lib" })).toBe("testing");
    expect(classifyToolActivity({ kind: "execute", title: "pytest -q" })).toBe("testing");
    expect(classifyToolActivity({ kind: "execute", title: "pnpm build:interface:web" })).toBe("executing");
    expect(classifyToolActivity({ kind: "execute", title: "git status" })).toBe("executing");
  });
});

describe("activity presentation contract", () => {
  it("flags only states that need the user", () => {
    expect(AGENT_ACTIVITIES.filter(isAttentionActivity)).toEqual(["waiting_user", "blocked", "quota_blocked", "errored"]);
  });

  it("has an English label for every activity", () => {
    const keys = enLocale as Record<string, string>;
    for (const activity of AGENT_ACTIVITIES) {
      expect(keys[`office.activity.${activity}`], activity).toBeTruthy();
    }
  });
});

describe("stream activity refinement", () => {
  it("refines a working worker with the server-derived activity", () => {
    expect(deriveAgentActivity({ workerStatus: "working", streamActivity: "testing" })).toBe("testing");
    expect(deriveAgentActivity({ workerStatus: "working", streamActivity: "waiting_user" })).toBe("waiting_user");
    expect(deriveAgentActivity({ workerStatus: "working", streamActivity: "working", latestToolCall: { kind: "read" } })).toBe("researching");
  });

  it("never lets a stale stream activity override idle, blocked, or terminal states", () => {
    expect(deriveAgentActivity({ workerStatus: "idle", streamActivity: "writing" })).toBe("idle");
    expect(deriveAgentActivity({ workerStatus: "stuck", streamActivity: "writing" })).toBe("blocked");
    expect(deriveAgentActivity({ workerStatus: "completed", streamActivity: "testing" })).toBe("done");
  });
});
