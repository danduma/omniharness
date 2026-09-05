import type { OmniHttpHandler } from "@/runtime/http/registry";
import { requireApiSession } from "@/server/auth/guards";
import { getClaudeAccountAuthService } from "@/server/accounts/claude-account-auth-service";
import { RuntimeHttpError } from "@/server/agent-runtime/types";
import { errorResponse } from "@/server/api-errors";

const AUTH_SOURCE = "Claude account sign-in";

function methodNotAllowed(allow: string) {
  return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
    status: 405,
    headers: { allow },
  });
}

async function body(request: Request) {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function accountId(context: Parameters<OmniHttpHandler>[1]) {
  return context.params?.id?.trim() ?? "";
}

async function authorize(request: Request, action: string) {
  const auth = await requireApiSession(request, {
    source: AUTH_SOURCE,
    action,
    enforceSameOrigin: request.method !== "GET",
  });
  return {
    ...auth,
    ownerSessionId: auth.session?.id ?? "automation-session",
  };
}

function routeError(error: unknown, action: string) {
  const status = error instanceof RuntimeHttpError ? error.statusCode : 500;
  return errorResponse(error, { status, source: AUTH_SOURCE, action });
}

export const handleClaudeAccountConnectRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const auth = await authorize(request, "Start Claude sign-in");
  if (auth.response) return auth.response;
  try {
    const input = await body(request);
    if (input.localSession === true) {
      const service = await getClaudeAccountAuthService();
      return Response.json(await service.signInLocal(auth.ownerSessionId));
    }
    const label = typeof input.label === "string" ? input.label : "";
    const email = typeof input.email === "string" ? input.email : null;
    const sso = input.sso === true;
    const service = await getClaudeAccountAuthService();
    return Response.json(await service.connect({
      label,
      email,
      sso,
      ownerSessionId: auth.ownerSessionId,
    }));
  } catch (error) {
    return routeError(error, "Start Claude sign-in");
  }
};

export const handleAccountAuthOperationRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed("GET, POST");
  const actionLabel = request.method === "GET" ? "Load Claude sign-in" : "Update Claude sign-in";
  const auth = await authorize(request, actionLabel);
  if (auth.response) return auth.response;
  try {
    const id = accountId(context);
    const service = await getClaudeAccountAuthService();
    if (request.method === "GET") {
      return Response.json(await service.getOperation(id, auth.ownerSessionId));
    }
    const input = await body(request);
    if (input.action !== "retry" && input.action !== "cancel") {
      return Response.json({ error: { code: "account.auth.invalid_action", message: "Action must be retry or cancel." } }, { status: 400 });
    }
    return Response.json(await service.act(id, input.action, auth.ownerSessionId));
  } catch (error) {
    return routeError(error, actionLabel);
  }
};

export const handleClaudeAccountLogoutRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const auth = await authorize(request, "Log out Claude account");
  if (auth.response) return auth.response;
  try {
    const service = await getClaudeAccountAuthService();
    return Response.json(await service.logout(accountId(context)));
  } catch (error) {
    return routeError(error, "Log out Claude account");
  }
};

export const handleClaudeAccountPurgeRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const auth = await authorize(request, "Purge Claude account");
  if (auth.response) return auth.response;
  try {
    const input = await body(request);
    const service = await getClaudeAccountAuthService();
    return Response.json(await service.purge(accountId(context), {
      purge: input.purge === true,
      confirmAccountId: typeof input.confirmAccountId === "string" ? input.confirmAccountId : "",
    }));
  } catch (error) {
    return routeError(error, "Purge Claude account");
  }
};
