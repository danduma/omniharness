import { buildRuntimeQuery, type RuntimeDomainRequest } from "../request";
import type { RuntimeEventStreamOpener } from "../stream";
import type { RuntimeAPIs, RuntimeCallOptions } from "../types";

export function createRuntimeDomains({
  request,
  openEvents,
}: {
  request: RuntimeDomainRequest;
  openEvents: RuntimeEventStreamOpener;
}): Omit<RuntimeAPIs, "runtime" | "native" | "editor"> {
  const encode = encodeURIComponent;
  const call = (
    method: string,
    path: string,
    body: unknown,
    options?: RuntimeCallOptions,
  ) => request(method, path, { body, signal: options?.signal });
  const get = (path: string, options?: RuntimeCallOptions) =>
    request("GET", path, { signal: options?.signal });
  const post = (path: string, body: unknown, options?: RuntimeCallOptions) =>
    call("POST", path, body, options);
  const patch = (path: string, body: unknown, options?: RuntimeCallOptions) =>
    call("PATCH", path, body, options);
  const remove = (path: string, body: unknown, options?: RuntimeCallOptions) =>
    call("DELETE", path, body, options);
  return {
    bootstrap: {
      load(input) {
        return get(`/api/runtime/bootstrap${buildRuntimeQuery({
          run: input.selectedRunId ?? null,
          project: input.draftProjectPath ?? null,
          pair: input.pairToken ?? null,
        })}`);
      },
    },
    events: {
      snapshot(input, options) {
        return request("GET", `/api/events${buildRuntimeQuery({
          snapshot: "1",
          persisted: input.persisted === false ? null : "1",
          runId: input.runId,
          checksum: input.checksum,
        })}`, {
          signal: options?.signal,
          includeResponseMetadata: true,
        }).then((result) => {
          const envelope = result as {
            data: unknown;
            headers?: Record<string, string>;
          };
          return {
            data: envelope.data,
            lastEventId: envelope.headers?.["x-omni-last-event-id"] ?? null,
          };
        });
      },
      open(input, handlers) {
        return openEvents(`/api/events${buildRuntimeQuery({
          snapshot: input.snapshot ? "1" : null,
          runId: input.runId,
        })}`, {
          lastEventId: input.lastEventId,
        }, handlers);
      },
      fetchLog(input) {
        return get(`/api/events/log${buildRuntimeQuery({
          since: input.since,
          runId: input.runId,
        })}`);
      },
    },
    auth: {
      session(options) {
        return get("/api/auth/session", options);
      },
      login(input, options) {
        return post("/api/auth/login", input, options);
      },
      logout(options) {
        return post("/api/auth/logout", {}, options);
      },
      createPair(input = {}, options) {
        return post("/api/auth/pair", input, options);
      },
      getPair(input, options) {
        return get(`/api/auth/pair${buildRuntimeQuery({ id: input.id })}`, options);
      },
      redeemPair(input, options) {
        return post("/api/auth/pair/redeem", input, options);
      },
      approveBrowserAuthorization(input, options) {
        return post("/api/auth/browser-authorization/approve", input, options);
      },
      exchangeBrowserAuthorization(input, options) {
        return post("/api/auth/browser-authorization/exchange", input, options);
      },
      revokeSession(input, options) {
        return remove("/api/auth/session", input, options);
      },
      revokeAllSessions(options) {
        return remove("/api/auth/session", { all: true }, options);
      },
      createStreamTicket(input, options) {
        return post("/api/auth/stream-ticket", input, options) as Promise<{
          ticket: string;
          expiresAt: string;
        }>;
      },
    },
    runner: {
      rename(input, options) {
        return patch("/api/runner", input, options);
      },
      rekey(input = {}, options) {
        return post("/api/runner/rekey", input, options);
      },
      restart(input = {}, options) {
        return post("/api/runner/restart", input, options);
      },
    },
    runs: {
      get(input, options) {
        return get(`/api/runs/${encode(input.runId)}`, options);
      },
      act(input, options) {
        return post(`/api/runs/${encode(input.runId)}`, input.body, options);
      },
      update(input, options) {
        return patch(`/api/runs/${encode(input.runId)}`, input.patch, options);
      },
      remove(input, options) {
        return remove(`/api/runs/${encode(input.runId)}`, input.body, options);
      },
      resume(input, options) {
        return post(`/api/runs/${encode(input.runId)}/resume`, input.body ?? {}, options);
      },
      answer(input, options) {
        return post(`/api/runs/${encode(input.runId)}/answer`, input.body, options);
      },
    },
    handoffs: {
      getActive(input, options) {
        return get(`/api/runs/${encode(input.runId)}/handoffs`, options) as ReturnType<RuntimeAPIs["handoffs"]["getActive"]>;
      },
      prepare(input, options) {
        return post(`/api/runs/${encode(input.runId)}/handoffs`, input.body, options) as ReturnType<RuntimeAPIs["handoffs"]["prepare"]>;
      },
      get(input, options) {
        return get(`/api/handoffs/${encode(input.handoffId)}?runId=${encode(input.sourceRunId)}`, options) as ReturnType<RuntimeAPIs["handoffs"]["get"]>;
      },
      revise(input, options) {
        return patch(`/api/handoffs/${encode(input.handoffId)}?runId=${encode(input.sourceRunId)}`, input.body, options) as ReturnType<RuntimeAPIs["handoffs"]["revise"]>;
      },
      launch(input, options) {
        return post(`/api/handoffs/${encode(input.handoffId)}/launch?runId=${encode(input.sourceRunId)}`, input.body, options) as ReturnType<RuntimeAPIs["handoffs"]["launch"]>;
      },
      cancel(input, options) {
        return post(`/api/handoffs/${encode(input.handoffId)}/cancel?runId=${encode(input.sourceRunId)}`, input.body ?? {}, options) as ReturnType<RuntimeAPIs["handoffs"]["cancel"]>;
      },
    },
    goals: {
      get(input, options) {
        return get(`/api/runs/${encode(input.runId)}/goal`, options) as Promise<{
          goal: import("@/shared/goal-plan").GoalSnapshot | null;
        }>;
      },
      put(input, options) {
        return call("PUT", `/api/runs/${encode(input.runId)}/goal`, input.body, options);
      },
      act(input, options) {
        return post(`/api/runs/${encode(input.runId)}/goal/actions`, input.body, options);
      },
    },
    conversations: {
      create(input, options) {
        return post("/api/conversations", input, options);
      },
      sendMessage(input, options) {
        return post("/api/messages", input, options);
      },
      sendTo(input, options) {
        return post(`/api/conversations/${encode(input.runId)}/messages`, input.body, options);
      },
      transcript(input, options) {
        return get(
          `/api/conversations/${encode(input.runId)}/transcript${buildRuntimeQuery({
            beforeSeq: input.beforeSeq == null ? null : String(input.beforeSeq),
            afterSeq: input.afterSeq == null ? null : String(input.afterSeq),
            beforeToken: input.beforeToken,
            afterToken: input.afterToken,
            limit: input.limit == null ? null : String(input.limit),
          })}`,
          options,
        );
      },
      updateQueuedMessage(input, options) {
        return patch(
          `/api/conversations/${encode(input.runId)}/queued-messages/${encode(input.messageId)}`,
          input.body,
          options,
        );
      },
      removeQueuedMessage(input, options) {
        return remove(
          `/api/conversations/${encode(input.runId)}/queued-messages/${encode(input.messageId)}`,
          undefined,
          options,
        );
      },
      interruptQueuedMessage(input, options) {
        return post(
          `/api/conversations/${encode(input.runId)}/queued-messages/${encode(input.messageId)}/interrupt`,
          input.body ?? {},
          options,
        );
      },
      interruptNextQueuedMessage(input, options) {
        return post(
          `/api/conversations/${encode(input.runId)}/queued-messages/interrupt-next`,
          input.body ?? {},
          options,
        );
      },
      listExternalSessions(input, options) {
        return get(`/api/external-sessions${buildRuntimeQuery({
          projectPath: input.projectPath,
        })}`, options);
      },
    },
    workers: {
      listEntries(input, options) {
        return get(
          `/api/workers/${encodeURIComponent(input.workerId)}/entries${buildRuntimeQuery({
            runId: input.runId,
            afterSeq: input.afterSeq == null
              ? null
              : String(input.afterSeq),
            beforeSeq: input.beforeSeq == null
              ? null
              : String(input.beforeSeq),
            limit: input.limit == null
              ? null
              : String(input.limit),
          })}`,
          options,
        );
      },
      content(input, options) {
        return request("GET", `/api/workers/${encodeURIComponent(input.workerId)}/entries${buildRuntimeQuery({
          contentEntryId: input.entryId,
        })}`, {
          responseType: "blob",
          signal: options?.signal,
        }) as Promise<Blob>;
      },
      getPlan(input, options) {
        return get(
          `/api/workers/${encodeURIComponent(input.workerId)}/entries${buildRuntimeQuery({
            runId: input.runId,
            view: "plan",
          })}`,
          options,
        ) as Promise<import("@/shared/acp-plan").WorkerPlanReadResponse>;
      },
      get(input, options) {
        return get(`/api/agents/${encode(input.workerId)}${buildRuntimeQuery({
          history: input.history,
        })}`, options);
      },
      prewarm(input = {}, options) {
        return post("/api/agents/prewarm-worker", input, options);
      },
      answerElicitation(input, options) {
        return post(`/api/agents/${encode(input.workerId)}/elicitation`, input.body, options);
      },
      answerPermission(input, options) {
        return post(`/api/agents/${encode(input.workerId)}/permission`, input.body, options);
      },
      catalog(input = {}, options) {
        return get(`/api/agents/catalog${buildRuntimeQuery({
          refresh: input.refresh ? "1" : null,
        })}`, options);
      },
    },
    files: {
      browse(input = {}, options) {
        return get(`/api/fs${buildRuntimeQuery({ path: input.path })}`, options);
      },
      createDirectory(input, options) {
        return post("/api/fs/directories", input, options) as Promise<{ path: string }>;
      },
      list(input, options) {
        return get(`/api/fs/files${buildRuntimeQuery({
          root: input.root,
          file: input.file,
        })}`, options);
      },
      upload(input, options) {
        return request("POST", "/api/attachments", {
          body: input,
          signal: options?.signal,
        });
      },
      attachment(input, options) {
        return request("GET", `/api/attachments${buildRuntimeQuery({
          path: input.path,
          mimeType: input.mimeType,
        })}`, {
          responseType: "blob",
          signal: options?.signal,
        }) as Promise<Blob>;
      },
    },
    git: {
      execute(input, options) {
        return post("/api/git", input, options);
      },
    },
    planning: {
      list(options) {
        return get("/api/plans", options);
      },
      promote(input, options) {
        return post(`/api/planning/${encode(input.runId)}/promote`, input.body, options);
      },
      review(input, options) {
        return post(`/api/planning/${encode(input.runId)}/review`, input.body, options);
      },
    },
    settings: {
      load(options) {
        return get("/api/settings", options);
      },
      save(input, options) {
        return post("/api/settings", input, options);
      },
      projectMemory: {
        load(input, options) {
          return get(`/api/projects/memory${buildRuntimeQuery({
            projectPath: input.projectPath,
            path: input.path,
          })}`, options);
        },
        save(input, options) {
          return post("/api/projects/memory", input, options);
        },
      },
      claudeGateway: {
        load(options) {
          return get("/api/integrations/claude-model-gateway", options);
        },
        execute(input, options) {
          return post("/api/integrations/claude-model-gateway", input, options);
        },
      },
    },
    accounts: {
      list(options) {
        return get("/api/accounts", options);
      },
      create(input, options) {
        return post("/api/accounts", input, options);
      },
      update(input, options) {
        return patch(`/api/accounts/${encode(input.accountId)}`, input.body, options);
      },
      remove(input, options) {
        return remove(`/api/accounts/${encode(input.accountId)}`, undefined, options) as ReturnType<RuntimeAPIs["accounts"]["remove"]>;
      },
      refreshStatus(input, options) {
        return post(`/api/accounts/${encode(input.accountId)}/status`, {}, options) as ReturnType<RuntimeAPIs["accounts"]["refreshStatus"]>;
      },
      connectClaude(input, options) {
        return post("/api/accounts/claude/connect", input, options) as ReturnType<RuntimeAPIs["accounts"]["connectClaude"]>;
      },
      getAuthOperation(input, options) {
        return get(`/api/accounts/${encode(input.accountId)}/auth-operation`, options) as ReturnType<RuntimeAPIs["accounts"]["getAuthOperation"]>;
      },
      actOnAuthOperation(input, options) {
        return post(`/api/accounts/${encode(input.accountId)}/auth-operation`, { action: input.action }, options) as ReturnType<RuntimeAPIs["accounts"]["actOnAuthOperation"]>;
      },
      logout(input, options) {
        return post(`/api/accounts/${encode(input.accountId)}/logout`, {}, options) as ReturnType<RuntimeAPIs["accounts"]["logout"]>;
      },
      purge(input, options) {
        return post(`/api/accounts/${encode(input.accountId)}/purge`, {
          purge: true,
          confirmAccountId: input.confirmAccountId,
        }, options) as ReturnType<RuntimeAPIs["accounts"]["purge"]>;
      },
      codexStatus(options) {
        return get("/api/codex-auth/status", options);
      },
    },
    notifications: {
      load(options) {
        return get("/api/notifications", options);
      },
      subscribe(input, options) {
        return post("/api/notifications", input, options);
      },
      unsubscribe(input, options) {
        return remove("/api/notifications", input, options);
      },
    },
    terminals: {
      create(input, options) {
        return post("/api/terminals", input, options);
      },
      input(input, options) {
        return post(`/api/terminals/${encode(input.terminalId)}/input`, input.body, options);
      },
      resize(input, options) {
        return post(`/api/terminals/${encode(input.terminalId)}/resize`, input.body, options);
      },
      close(input, options) {
        return remove(`/api/terminals/${encode(input.terminalId)}`, undefined, options);
      },
      openStream(input, handlers) {
        return openEvents(
          `/api/terminals/${encode(input.terminalId)}/stream`,
          { lastEventId: input.lastEventId },
          handlers,
        );
      },
    },
  };
}
