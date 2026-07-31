import { insertAuthEvent } from "@/server/auth/audit";
import { requireApiSession } from "@/server/auth/guards";
import {
  ensureRunnerIdentity,
  rekeyRunnerIdentity,
  renameRunner,
} from "@/server/runner/identity";
import { emitNamedEvent } from "@/server/events/named-events";
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
