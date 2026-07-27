import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/guards", () => ({
  requireApiSession: vi.fn(() => Promise.resolve({ session: { id: "s1" }, response: null })),
}));

const { mockRespondElicitation, mockApprovePermission, mockDenyPermission } = vi.hoisted(() => ({
  mockRespondElicitation: vi.fn(),
  mockApprovePermission: vi.fn(),
  mockDenyPermission: vi.fn(),
}));

vi.mock("@/server/bridge-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/bridge-client")>("@/server/bridge-client");
  return {
    ...actual,
    respondElicitation: mockRespondElicitation,
    approvePermission: mockApprovePermission,
    denyPermission: mockDenyPermission,
  };
});

import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import {
  handleAgentElicitationRequest,
  handleAgentPermissionRequest,
} from "@/runtime/http/routes/agent-detail";

const ctx = (name: string) => ({ surface: "web" as const, params: { name } });

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

function conflict(message: string) {
  return Object.assign(new Error(message), { status: 409 });
}

async function seedWorkerWithOpenRequest(type: "elicitation" | "permission", requestId: number) {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `worker-${randomUUID()}`;

  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/human-input.md",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    status: "awaiting_user",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "claude",
    cwd: "/tmp",
    status: "working",
    workerNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await writeWorkerOutputEntries(runId, workerId, [
    {
      id: randomUUID(),
      type,
      status: "pending",
      text: `${type} raised`,
      timestamp: new Date().toISOString(),
      raw: { requestId },
    },
  ]);

  return { runId, workerId };
}

beforeEach(() => {
  __resetOutputStoreCachesForTests();
  mockRespondElicitation.mockReset();
  mockApprovePermission.mockReset();
  mockDenyPermission.mockReset();
});

describe("human-input responses that the runtime no longer holds", () => {
  it("answers a dead question with 409, not an opaque 500", async () => {
    const { workerId } = await seedWorkerWithOpenRequest("elicitation", 2);
    mockRespondElicitation.mockRejectedValue(conflict("Respond elicitation failed: no_pending_elicitations"));

    const res = await handleAgentElicitationRequest(
      jsonRequest(`http://localhost/api/agents/${workerId}/elicitation`, {
        requestId: 2,
        action: "accept",
        content: { choice: "a" },
      }),
      ctx(workerId),
    );

    expect(res.status).toBe(409);
  });

  it("closes the orphaned stream row so the question stops being re-offered", async () => {
    const { runId, workerId } = await seedWorkerWithOpenRequest("elicitation", 2);
    mockRespondElicitation.mockRejectedValue(conflict("Respond elicitation failed: no_pending_elicitations"));

    await handleAgentElicitationRequest(
      jsonRequest(`http://localhost/api/agents/${workerId}/elicitation`, { requestId: 2, action: "accept" }),
      ctx(workerId),
    );

    const entries = await readWorkerOutputEntries(runId, workerId);
    const rows = entries.filter((entry) => entry.type === "elicitation");
    expect(rows).toHaveLength(2);
    expect(rows.at(-1)?.status).toBe("cancelled");
    expect((rows.at(-1)?.raw as { requestId?: number } | undefined)?.requestId).toBe(2);
  });

  it("leaves the stream alone when the response succeeds", async () => {
    const { runId, workerId } = await seedWorkerWithOpenRequest("elicitation", 3);
    mockRespondElicitation.mockResolvedValue({ ok: true, requestId: 3 });

    const res = await handleAgentElicitationRequest(
      jsonRequest(`http://localhost/api/agents/${workerId}/elicitation`, { requestId: 3, action: "accept" }),
      ctx(workerId),
    );

    expect(res.status).toBe(200);
    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.filter((entry) => entry.type === "elicitation")).toHaveLength(1);
  });

  it("still reports genuine runtime failures as 500", async () => {
    const { workerId } = await seedWorkerWithOpenRequest("elicitation", 4);
    mockRespondElicitation.mockRejectedValue(new Error("Respond elicitation failed: ECONNRESET"));

    const res = await handleAgentElicitationRequest(
      jsonRequest(`http://localhost/api/agents/${workerId}/elicitation`, { requestId: 4, action: "accept" }),
      ctx(workerId),
    );

    expect(res.status).toBe(500);
  });

  it("applies the same treatment to permission decisions", async () => {
    const { runId, workerId } = await seedWorkerWithOpenRequest("permission", 5);
    mockApprovePermission.mockRejectedValue(conflict("Approve permission failed: no_pending_permissions"));

    const res = await handleAgentPermissionRequest(
      jsonRequest(`http://localhost/api/agents/${workerId}/permission`, { requestId: 5, decision: "approve" }),
      ctx(workerId),
    );

    expect(res.status).toBe(409);
    const rows = (await readWorkerOutputEntries(runId, workerId)).filter((entry) => entry.type === "permission");
    expect(rows.at(-1)?.status).toBe("cancelled");
  });
});
