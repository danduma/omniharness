import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orchestrationStages, settings } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { getBuiltInWorkerModelOptions } from "@/server/worker-models";
import { SUPPORTED_WORKER_TYPES } from "@/shared/worker-types";
import { ORCHESTRATION_POLICY_SETTING_KEY, createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";
import type { OmniRequestContext } from "@/runtime/http/registry";
import { insertStageRow, seedOrchestrationRun } from "../server/orchestration/fixtures";

vi.mock("@/server/bridge-client", () => ({
  askAgent: vi.fn(),
  getAgent: vi.fn(),
  spawnAgent: vi.fn(),
  cancelAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

// Binding preflight inspects installed CLIs; that is environment.
vi.mock("@/server/orchestration/model-catalog", async () => {
  const actual = await vi.importActual<typeof import("@/server/orchestration/model-catalog")>("@/server/orchestration/model-catalog");
  return {
    ...actual,
    createDefaultPreflightContext: () => ({
      catalog: Object.fromEntries(SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)])),
      availability: (type: string) => ({ installed: type !== "gemini", credentials: true }),
      isQuotaBlocked: async () => false,
      validateAccount: async () => undefined,
      decisionKeyConfigured: false,
    }),
  };
});

import {
  __resetOrchestrationIdempotencyForTests,
  handleOrchestrationPolicyRequest,
  handleOrchestrationPreflightRequest,
  handleRunOrchestrationRequest,
} from "@/runtime/http/routes/orchestration";

async function request(url: string, init: RequestInit & { sameOrigin?: boolean } = {}) {
  const session = await createAuthSession({ label: "Orchestration test", userAgent: "Vitest", authMethod: "password_login" });
  const headers = new Headers(init.headers);
  headers.set("cookie", `omni_session=${session.tokenValue}`);
  if (init.method && init.method !== "GET") headers.set("origin", init.sameOrigin === false ? "http://evil.example" : "http://localhost");
  if (init.body) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

function post(url: string, body: unknown, extra: RequestInit & { sameOrigin?: boolean } = {}) {
  return request(url, { method: "POST", body: JSON.stringify(body), ...extra });
}

function ctx(id?: string): OmniRequestContext {
  const params: Record<string, string> = id ? { id } : {};
  return { surface: "test", params };
}

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

describe("orchestration HTTP API", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    __resetNamedEventsForTests();
    __resetOrchestrationIdempotencyForTests();
    await db.delete(settings).where(eq(settings.key, ORCHESTRATION_POLICY_SETTING_KEY));
  });
  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
  });

  it("returns the defaults and rejects an invalid policy without saving it", async () => {
    const loaded = await handleOrchestrationPolicyRequest(await request("http://localhost/api/orchestration/policy"), ctx());
    expect(loaded.status).toBe(200);
    expect((await loaded.json()).policy.defaultProfile).toBe("balanced");

    const invalid = createDefaultOrchestrationPolicy() as any;
    invalid.profiles.balanced.stages = invalid.profiles.balanced.stages.filter((stage: { stage: string }) => stage.stage !== "implement");
    const response = await handleOrchestrationPolicyRequest(await request("http://localhost/api/orchestration/policy", { method: "PUT", body: JSON.stringify({ policy: invalid }) }), ctx());
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing_implementation" })]));
    expect(await db.select().from(settings).where(eq(settings.key, ORCHESTRATION_POLICY_SETTING_KEY)).get()).toBeUndefined();
    expect(events().some((event) => event.kind === "orchestration.policy_rejected")).toBe(true);
  });

  it("rejects a policy carrying a credential", async () => {
    const policy = createDefaultOrchestrationPolicy() as any;
    policy.profiles.balanced.stages[1].binding.token = ["sk", "test", "q".repeat(24)].join("-");
    const response = await handleOrchestrationPolicyRequest(await request("http://localhost/api/orchestration/policy", { method: "PUT", body: JSON.stringify({ policy }) }), ctx());
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ code: "secret_in_policy", path: "" }]);
  });

  it("saves a valid policy", async () => {
    const policy = createDefaultOrchestrationPolicy();
    policy.defaultProfile = "economy";
    const response = await handleOrchestrationPolicyRequest(await request("http://localhost/api/orchestration/policy", { method: "PUT", body: JSON.stringify({ policy }) }), ctx());
    expect(response.status).toBe(200);
    const row = await db.select().from(settings).where(eq(settings.key, ORCHESTRATION_POLICY_SETTING_KEY)).get();
    expect(JSON.parse(row!.value).defaultProfile).toBe("economy");
  });

  it("preflights a profile without writing anything", async () => {
    const before = (await db.select().from(orchestrationStages)).length;
    const response = await handleOrchestrationPreflightRequest(await post("http://localhost/api/orchestration/preflight", { profile: "thorough" }), ctx());
    expect(response.status).toBe(200);
    const { report } = await response.json();
    expect(report.profile).toBe("thorough");
    expect(report.ready).toBe(true); // triage (no key) never blocks readiness
    expect(report.stages.find((stage: { stage: string }) => stage.stage === "triage").status).toBe("credential_missing");
    expect((await db.select().from(orchestrationStages)).length).toBe(before);
    expect(await db.select().from(settings).where(eq(settings.key, ORCHESTRATION_POLICY_SETTING_KEY)).get()).toBeUndefined();
  });

  it("refuses cross-origin mutations", async () => {
    const { runId } = await seedOrchestrationRun();
    const response = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create" }, { sameOrigin: false }), ctx(runId));
    expect(response.status).toBe(403);
  });

  it("replays an idempotent create instead of acting twice", async () => {
    const { runId } = await seedOrchestrationRun();
    const headers = { "idempotency-key": "create-1" };
    const first = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create", profile: "economy" }, { headers }), ctx(runId));
    const second = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create", profile: "economy" }, { headers }), ctx(runId));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, created: true, profile: "economy" });
    expect(second.headers.get("idempotent-replay")).toBe("true");
    expect(events().filter((event) => event.kind === "orchestration.workflow_created")).toHaveLength(1);
  });

  it("returns typed conflicts for an active dispatch and a locked profile, with stable events", async () => {
    const { runId } = await seedOrchestrationRun();
    await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create" }), ctx(runId));
    await insertStageRow(runId, { stageKey: "triage", status: "completed", outcome: "advisory" });
    await insertStageRow(runId, { stageKey: "plan", status: "waiting" });
    await db.update((await import("@/server/db/schema")).runs).set({ orchestrationProfileLockedAt: new Date() }).where(eq((await import("@/server/db/schema")).runs.id, runId));

    const dispatch = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "dispatch" }), ctx(runId));
    expect(dispatch.status).toBe(200);
    expect(await dispatch.json()).toMatchObject({ ok: false, result: { status: "conflict", stage: "plan" } });

    const select = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "select_profile", profile: "economy" }), ctx(runId));
    expect(select.status).toBe(200);
    expect(await select.json()).toEqual({ ok: false, refused: "profile_locked" });
    expect(events().some((event) => event.kind === "error.surfaced" && event.code === "orchestration.profile_locked")).toBe(true);
  });

  it("returns the workflow snapshot over GET and null when there is none", async () => {
    const { runId } = await seedOrchestrationRun();
    const none = await handleRunOrchestrationRequest(await request(`http://localhost/api/runs/${runId}/orchestration`), ctx(runId));
    expect(await none.json()).toEqual({ workflow: null });
    await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create", profile: "thorough" }), ctx(runId));
    const snapshot = await handleRunOrchestrationRequest(await request(`http://localhost/api/runs/${runId}/orchestration`), ctx(runId));
    const body = await snapshot.json();
    expect(body.workflow).toMatchObject({ profile: "thorough", profileSource: "user", locked: false, stages: [] });
  });

  it("refuses direct conversations and unknown actions", async () => {
    const { runId } = await seedOrchestrationRun({ mode: "direct", phase: null });
    const refused = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "create" }), ctx(runId));
    expect(await refused.json()).toEqual({ ok: false, refused: "unsupported_run" });
    const unknown = await handleRunOrchestrationRequest(await post(`http://localhost/api/runs/${runId}/orchestration`, { action: "launch_rockets" }), ctx(runId));
    expect(unknown.status).toBe(400);
  });
});
