import { insertAuthEvent } from "@/server/auth/audit";
import { requireApiSession } from "@/server/auth/guards";
import {
  ensureRunnerIdentity,
  rekeyRunnerIdentity,
  renameRunner,
} from "@/server/runner/identity";
import { emitNamedEvent } from "@/server/events/named-events";
import { requestRunnerRestart } from "@/server/runner/restart-request";
import type { OmniHttpHandler } from "@/runtime/http/registry";

function methodNotAllowed(allow: string) {
  return Response.json({
    error: { code: "method_not_allowed", message: "Method not allowed." },
  }, {
    status: 405,
    headers: { allow },
  });
}

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object"
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export const handleRunnerSettingsRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "PATCH") {
    return methodNotAllowed("PATCH");
  }
  const auth = await requireApiSession(request, {
    source: "Server",
    action: "Rename server",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await readBody(request);
  try {
    const previous = await ensureRunnerIdentity();
    const next = await renameRunner(typeof body.name === "string" ? body.name : "");
    await insertAuthEvent({
      eventType: "runner.renamed",
      sessionId: auth.session?.id ?? null,
      details: {
        runnerInstanceId: next.runnerInstanceId,
        previousName: previous.name,
        name: next.name,
      },
    });
    emitNamedEvent({
      kind: "runner.renamed",
      runnerInstanceId: next.runnerInstanceId,
      previousName: previous.name,
      name: next.name,
    });
    return Response.json({ runner: next });
  } catch (error) {
    return Response.json({
      error: {
        code: "runner.invalid_name",
        message: error instanceof Error ? error.message : String(error),
      },
    }, { status: 400 });
  }
};

export const handleRunnerRekeyRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const auth = await requireApiSession(request, {
    source: "Server",
    action: "Rekey server",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const current = await ensureRunnerIdentity();
  const body = await readBody(request);
  if (
    auth.session?.transport === "bearer"
    && body.confirmRunnerInstanceId !== current.runnerInstanceId
  ) {
    return Response.json({
      error: {
        code: "runner.identity_confirmation_required",
        message: "Confirm the current server identity before rekeying a remote server.",
      },
    }, { status: 409 });
  }

  const next = await rekeyRunnerIdentity();
  await insertAuthEvent({
    eventType: "runner.rekeyed",
    sessionId: auth.session?.id ?? null,
    details: {
      previousRunnerInstanceId: current.runnerInstanceId,
      runnerInstanceId: next.runnerInstanceId,
    },
  });
  emitNamedEvent({
    kind: "runner.rekeyed",
    previousRunnerInstanceId: current.runnerInstanceId,
    runnerInstanceId: next.runnerInstanceId,
  });
  return Response.json({
    runner: next,
    previousRunnerInstanceId: current.runnerInstanceId,
  });
};

export const handleRunnerRestartRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  // Same-origin only, like rekey: restarting kills every in-flight worker turn
  // on this machine, so it is not something a bearer token from elsewhere gets
  // to trigger.
  const auth = await requireApiSession(request, {
    source: "Server",
    action: "Restart server",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const outcome = await requestRunnerRestart();
  if (!outcome.ok) {
    await insertAuthEvent({
      eventType: "runner.restart_failed",
      sessionId: auth.session?.id ?? null,
      details: { code: outcome.code, message: outcome.message },
    });
    return Response.json({
      error: { code: `runner.restart.${outcome.code}`, message: outcome.message },
    }, { status: outcome.code === "control_unavailable" ? 503 : 502 });
  }

  await insertAuthEvent({
    eventType: "runner.restart_requested",
    sessionId: auth.session?.id ?? null,
    details: { pid: outcome.pid, mode: outcome.mode },
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "runner.restarting",
    message: "Restarting the server. Active worker turns will be interrupted and recovered.",
    surface: "toast",
  });
  // 202: the control server has accepted the job. This runner is about to be
  // killed, so the response goes out before the process actually dies.
  return Response.json({
    ok: true,
    pid: outcome.pid,
    mode: outcome.mode,
    startedAt: outcome.startedAt,
  }, { status: 202 });
};
