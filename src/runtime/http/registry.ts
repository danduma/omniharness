import type { RuntimeSurface } from "@/server/events/named-events";

export type RuntimeErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
  surface?: RuntimeSurface | string;
  runId?: string;
  workerId?: string;
  conversationId?: string;
};

export interface OmniRequestContext {
  surface: RuntimeSurface | string;
  runtime?: unknown;
  params?: Record<string, string>;
}

export type OmniHttpHandler = (
  request: Request,
  context: OmniRequestContext,
) => Promise<Response> | Response;

type Method = string;

function normalizeMethod(method: string): Method {
  return method.trim().toUpperCase();
}

function routeKey(method: string, pathname: string) {
  return `${normalizeMethod(method)} ${pathname}`;
}

function jsonError(status: number, error: RuntimeErrorPayload) {
  return Response.json({ error }, { status });
}

export class OmniHttpRegistry {
  private readonly routes = new Map<string, OmniHttpHandler>();
  private readonly dynamicRoutes: Array<{
    method: Method;
    pathname: string;
    parts: string[];
    handler: OmniHttpHandler;
  }> = [];

  route(method: string, pathname: string, handler: OmniHttpHandler) {
    const normalizedMethod = normalizeMethod(method);
    if (pathname.split("/").some((part) => part.startsWith(":"))) {
      this.dynamicRoutes.push({
        method: normalizedMethod,
        pathname,
        parts: pathname.split("/").filter(Boolean),
        handler,
      });
      return this;
    }

    this.routes.set(routeKey(normalizedMethod, pathname), handler);
    return this;
  }

  private matchDynamicRoute(method: Method, pathname: string) {
    const actualParts = pathname.split("/").filter(Boolean);
    for (const route of this.dynamicRoutes) {
      if (route.method !== method || route.parts.length !== actualParts.length) {
        continue;
      }
      const params: Record<string, string> = {};
      let matched = true;
      for (let index = 0; index < route.parts.length; index += 1) {
        const expected = route.parts[index] ?? "";
        const actual = actualParts[index] ?? "";
        if (expected.startsWith(":")) {
          params[expected.slice(1)] = decodeURIComponent(actual);
          continue;
        }
        if (expected !== actual) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  async handle(request: Request, context: OmniRequestContext): Promise<Response> {
    const url = new URL(request.url);
    const method = normalizeMethod(request.method);
    const key = routeKey(method, url.pathname);
    const exactHandler = this.routes.get(key);
    const dynamicMatch = exactHandler ? null : this.matchDynamicRoute(method, url.pathname);
    const handler = exactHandler ?? dynamicMatch?.handler;
    if (!handler) {
      return jsonError(404, {
        code: "route.not_found",
        message: `No runtime route registered for ${method} ${url.pathname}.`,
        surface: context.surface,
      });
    }

    try {
      return await handler(request, dynamicMatch ? {
        ...context,
        params: {
          ...context.params,
          ...dynamicMatch.params,
        },
      } : context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(500, {
        code: "route.failed",
        message,
        surface: context.surface,
      });
    }
  }
}

export function createOmniHttpRegistry() {
  return new OmniHttpRegistry();
}
