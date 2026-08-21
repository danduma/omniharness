import { describe, expect, it } from "vitest";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import {
  createVSCodeRuntimeAPIs,
  type VSCodeRuntimeApiTransport,
} from "@/runtime-api/vscode";
import {
  createElectronRuntimeAPIs,
  type ElectronNativeBridge,
} from "@/runtime-api/electron";
import {
  createCapacitorRuntimeAPIs,
  type OmniNativeRuntimePlugin,
} from "@/runtime-api/capacitor";

type CapturedCall = {
  method: string;
  path: string;
  body?: unknown;
};

function createWebHarness() {
  const calls: CapturedCall[] = [];
  const apis = createWebRuntimeAPIs({
    fetchImpl: async (input, init) => {
      const body = init?.body instanceof FormData
        ? "form-data"
        : typeof init?.body === "string"
          ? JSON.parse(init.body)
          : undefined;
      calls.push({
        method: init?.method ?? "GET",
        path: String(input),
        body,
      });
      if (String(input).startsWith("/api/attachments?")) {
        return new Response(new Uint8Array([7]), {
          headers: { "content-type": "application/octet-stream" },
        });
      }
      return Response.json({ ok: true });
    },
  });
  return { apis, calls };
}

function createVSCodeHarness() {
  const calls: CapturedCall[] = [];
  const listeners = new Set<(message: unknown) => void>();
  const transport: VSCodeRuntimeApiTransport = {
    postMessage(message) {
      if (message.type !== "api:proxy") {
        return;
      }
      const payload = message.payload as {
        method: string;
        path: string;
        bodyText?: string;
        formData?: unknown;
        responseType?: string;
      };
      calls.push({
        method: payload.method,
        path: payload.path,
        body: payload.formData
          ? "form-data"
          : payload.bodyText
            ? JSON.parse(payload.bodyText)
            : undefined,
      });
      queueMicrotask(() => {
        for (const listener of listeners) {
          listener({
            id: message.id,
            type: "api:proxy",
            success: true,
            data: {
              status: 200,
              headers: {
                "content-type": payload.responseType
                  ? "application/octet-stream"
                  : "application/json",
              },
              bodyText: payload.responseType ? undefined : "{\"ok\":true}",
              bodyBytes: payload.responseType ? [7] : undefined,
            },
          });
        }
      });
    },
    addMessageListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    apis: createVSCodeRuntimeAPIs({ transport }),
    calls,
  };
}

function createElectronHarness() {
  const calls: CapturedCall[] = [];
  const bridge: ElectronNativeBridge = {
    async invokeRuntime(message) {
      const payload = message.payload as {
        method?: string;
        path?: string;
        bodyText?: string;
        formData?: unknown;
        responseType?: string;
      };
      calls.push({
        method: payload.method ?? "GET",
        path: payload.path ?? "",
        body: payload.formData
          ? "form-data"
          : payload.bodyText
            ? JSON.parse(payload.bodyText)
            : undefined,
      });
      return {
        id: message.id,
        type: message.type,
        success: true,
        data: {
          status: 200,
          headers: {
            "content-type": payload.responseType
              ? "application/octet-stream"
              : "application/json",
          },
          bodyText: payload.responseType ? undefined : "{\"ok\":true}",
          bodyBytes: payload.responseType ? [7] : undefined,
        },
      };
    },
    addRuntimeListener: () => () => {},
    profileGet: () => null,
    profileSet: () => {},
    profileRemove: () => {},
    credential: async () => null,
    tls: async () => null,
    openExternal: async () => ({ ok: true }),
  };
  return {
    apis: createElectronRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: "credential-1",
        runnerInstanceId: "runner-1",
      },
      bridge,
    }),
    calls,
  };
}

function createCapacitorHarness() {
  const calls: CapturedCall[] = [];
  const plugin: OmniNativeRuntimePlugin = {
    async request(payload) {
      calls.push({
        method: payload.method,
        path: payload.path,
        body: payload.formData
          ? "form-data"
          : payload.bodyText
            ? JSON.parse(payload.bodyText)
            : undefined,
      });
      return payload.responseType
        ? {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
            bodyBase64: "Bw==",
          }
        : {
            status: 200,
            headers: { "content-type": "application/json" },
            bodyText: "{\"ok\":true}",
          };
    },
    async cancelRequest() {
      return { ok: true };
    },
    async authorize() {
      return { credentialRef: "mobile-credential" };
    },
    async credential() {
      return {};
    },
    async confirmTls() {
      return { ok: true };
    },
    async openStream() {
      return { ok: true };
    },
    async closeStream() {
      return { ok: true };
    },
    async openExternal() {
      return { ok: true };
    },
    async notify() {
      return { ok: true };
    },
    async addListener() {
      return { remove: async () => {} };
    },
  };
  return {
    apis: createCapacitorRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: "credential-1",
        runnerInstanceId: "runner-1",
      },
      plugin,
    }),
    calls,
  };
}

async function callEveryDomainMethod(apis: RuntimeAPIs) {
  await apis.events.snapshot({ runId: "run/1" });
  await apis.auth.session();
  await apis.auth.login({ password: "redacted" });
  await apis.auth.logout();
  await apis.auth.createPair();
  await apis.auth.getPair({ id: "pair 1" });
  await apis.auth.redeemPair({ token: "redacted" });
  await apis.auth.revokeSession({ sessionId: "session/1" });
  await apis.auth.revokeAllSessions();
  await apis.runner.rename({ name: "Studio runner" });
  await apis.runner.rekey({ confirmRunnerInstanceId: "runner/1" });
  await apis.runs.get({ runId: "run/1" });
  await apis.runs.act({ runId: "run/1", body: { action: "archive" } });
  await apis.runs.update({ runId: "run/1", patch: { title: "x" } });
  await apis.runs.remove({ runId: "run/1" });
  await apis.runs.resume({ runId: "run/1" });
  await apis.runs.answer({ runId: "run/1", body: { answer: "yes" } });
  await apis.conversations.create({ projectPath: "/tmp/a" });
  await apis.conversations.sendMessage({ runId: "run-1" });
  await apis.conversations.sendTo({ runId: "run/1", body: { text: "hi" } });
  await apis.conversations.transcript({ runId: "run/1", beforeSeq: 4, limit: 2 });
  await apis.conversations.updateQueuedMessage({
    runId: "run/1",
    messageId: "message/1",
    body: { text: "new" },
  });
  await apis.conversations.removeQueuedMessage({
    runId: "run/1",
    messageId: "message/1",
  });
  await apis.conversations.interruptQueuedMessage({
    runId: "run/1",
    messageId: "message/1",
  });
  await apis.conversations.interruptNextQueuedMessage({ runId: "run/1" });
  await apis.conversations.listExternalSessions({ projectPath: "/tmp/a" });
  await apis.workers.listEntries({ workerId: "worker/1", afterSeq: 3 });
  await apis.workers.content({ workerId: "worker/1", entryId: "entry/1" });
  await apis.workers.get({ workerId: "worker/1", history: "full" });
  await apis.workers.prewarm({ workerType: "codex" });
  await apis.workers.answerElicitation({ workerId: "worker/1", body: { answer: "a" } });
  await apis.workers.answerPermission({ workerId: "worker/1", body: { decision: "allow" } });
  await apis.workers.catalog({ refresh: true });
  await apis.files.browse({ path: "/tmp/a b" });
  await apis.files.createDirectory({ parentPath: "/tmp/a", name: "new project" });
  await apis.files.list({ root: "/tmp/a", file: "a b.ts" });
  const formData = new FormData();
  formData.append("projectPath", "/tmp/a");
  await apis.files.upload(formData);
  await apis.files.attachment({ path: "stored/a.png", mimeType: "image/png" });
  await apis.git.execute({ action: "status" });
  await apis.planning.list();
  await apis.planning.promote({ runId: "run/1", body: { planPath: null } });
  await apis.planning.review({ runId: "run/1", body: { rounds: 1 } });
  await apis.settings.load();
  await apis.settings.save({ theme: "night" });
  await apis.settings.projectMemory.load({ projectPath: "/tmp/a", path: "notes/a.md" });
  await apis.settings.projectMemory.save({ projectPath: "/tmp/a", action: "write" });
  await apis.settings.claudeGateway.load();
  await apis.settings.claudeGateway.execute({ action: "status" });
  await apis.accounts.list();
  await apis.accounts.create({ workerType: "codex" });
  await apis.accounts.update({ accountId: "account/1", body: { enabled: true } });
  await apis.accounts.remove({ accountId: "account/1" });
  await apis.accounts.refreshStatus({ accountId: "account/1" });
  await apis.accounts.connectClaude({ label: "Personal" });
  await apis.accounts.getAuthOperation({ accountId: "account/1" });
  await apis.accounts.actOnAuthOperation({ accountId: "account/1", action: "retry" });
  await apis.accounts.logout({ accountId: "account/1" });
  await apis.accounts.purge({ accountId: "account/1", confirmAccountId: "account/1" });
  await apis.accounts.codexStatus();
  await apis.notifications.load();
  await apis.notifications.subscribe({ subscription: {} });
  await apis.notifications.unsubscribe({ endpoint: "https://push.invalid" });
  await apis.terminals.create({ cwd: "/tmp/a" });
  await apis.terminals.input({ terminalId: "terminal/1", body: { data: "ls\n" } });
  await apis.terminals.resize({ terminalId: "terminal/1", body: { cols: 80, rows: 24 } });
  await apis.terminals.close({ terminalId: "terminal/1" });
}

describe.each([
  ["web", createWebHarness],
  ["validated Electron host", createElectronHarness],
  ["validated VS Code host", createVSCodeHarness],
  ["validated Capacitor host", createCapacitorHarness],
] as const)("RuntimeAPIs adapter contract: %s", (_name, createHarness) => {
  it("maps every transport-neutral domain method to the same HTTP contract", async () => {
    const { apis, calls } = createHarness();
    await callEveryDomainMethod(apis);

    expect(calls).toHaveLength(66);
    expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual(
      expect.arrayContaining([
        "GET /api/auth/session",
        "DELETE /api/auth/session",
        "PATCH /api/runner",
        "POST /api/runner/rekey",
        "PATCH /api/runs/run%2F1",
        "GET /api/conversations/run%2F1/transcript?beforeSeq=4&limit=2",
        "GET /api/external-sessions?projectPath=%2Ftmp%2Fa",
        "GET /api/workers/worker%2F1/entries?afterSeq=3",
        "GET /api/workers/worker%2F1/entries?contentEntryId=entry%2F1",
        "POST /api/fs/directories",
        "POST /api/attachments",
        "POST /api/git",
        "POST /api/planning/run%2F1/review",
        "GET /api/settings",
        "POST /api/accounts/account%2F1/status",
        "POST /api/accounts/claude/connect",
        "GET /api/accounts/account%2F1/auth-operation",
        "POST /api/accounts/account%2F1/auth-operation",
        "POST /api/accounts/account%2F1/logout",
        "POST /api/accounts/account%2F1/purge",
        "GET /api/codex-auth/status",
        "POST /api/integrations/claude-model-gateway",
        "DELETE /api/notifications",
        "POST /api/terminals/terminal%2F1/resize",
      ]),
    );
  });
});
