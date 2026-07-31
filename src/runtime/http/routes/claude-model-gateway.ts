import { z } from "zod";
import { getClaudeModelGatewayService } from "@/server/integrations/claude-model-gateway";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";

type GatewayService = Pick<ReturnType<typeof getClaudeModelGatewayService>,
  "inspect" | "install" | "start" | "stop" | "connect" | "refreshModels">;

const actionSchema = z.object({
  action: z.enum(["install", "start", "stop", "connect", "refresh_models"]),
}).strict();

function routeError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export function createClaudeModelGatewayHandler(service: GatewayService): OmniHttpHandler {
  return async (request) => {
    if (request.method !== "GET" && request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Claude model gateway",
      action: request.method === "GET" ? "Inspect gateway" : "Control gateway",
      enforceSameOrigin: request.method === "POST",
    });
    if (auth.response) return auth.response;

    if (request.method === "GET") {
      return Response.json({ status: await service.inspect() });
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return routeError(400, "invalid_content_type", "Content-Type must be application/json.");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return routeError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return routeError(400, "invalid_request", "Gateway action request is invalid.");

    try {
      const result = parsed.data.action === "install"
        ? await service.install()
        : parsed.data.action === "start"
          ? await service.start()
          : parsed.data.action === "stop"
            ? await service.stop()
            : parsed.data.action === "connect"
              ? await service.connect()
              : await service.refreshModels();
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not installed|disabled|not configured|invalid|unsupported/i.test(message) ? 409 : 502;
      return routeError(status, status === 409 ? "gateway_action_refused" : "gateway_action_failed", message);
    }
  };
}

export const handleClaudeModelGatewayRequest = createClaudeModelGatewayHandler(getClaudeModelGatewayService());
