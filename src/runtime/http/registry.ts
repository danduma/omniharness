import type { RuntimeSurface } from "@/server/events/named-events";
import {
  attachBearerCors,
  buildBearerCorsPreflight,
} from "@/server/auth/cors";

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

export type OmniRouteAuth =
  | "public"
  | "session"
  | "same-origin-session"
  | "native-session";

export type OmniRouteResponseKind =
  | "json"
  | "stream"
  | "multipart"
  | "empty";

export interface OmniRouteMetadata {
  auth?: OmniRouteAuth;
  responseKind?: OmniRouteResponseKind;
}

export interface OmniRouteDescriptor extends OmniRouteMetadata {
  method: Method;
  pathname: string;
}

type RegisteredRoute = OmniRouteDescriptor & {
  parts: string[];
  handler: OmniHttpHandler;
};

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
  private readonly routes = new Map<string, RegisteredRoute>();
  private readonly dynamicRoutes: RegisteredRoute[] = [];
  private readonly descriptors: OmniRouteDescriptor[] = [];

  route(
    method: string,
    pathname: string,
    handler: OmniHttpHandler,
    metadata: OmniRouteMetadata = {},
  ) {
    const normalizedMethod = normalizeMethod(method);
    const route = {
      method: normalizedMethod,
      pathname,
      parts: pathname.split("/").filter(Boolean),
      handler,
      auth: metadata.auth ?? "session",
      ...metadata,
    };
    this.descriptors.push({
      method: normalizedMethod,
      pathname,
      auth: metadata.auth ?? "session",
      ...metadata,
    });
    if (pathname.split("/").some((part) => part.startsWith(":"))) {
      this.dynamicRoutes.push(route);
      return this;
    }

    this.routes.set(routeKey(normalizedMethod, pathname), route);
    return this;
  }

  listRoutes() {
    return this.descriptors.map((descriptor) => ({ ...descriptor }));
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
    const exactRoute = this.routes.get(key);
    const dynamicMatch = exactRoute
      ? null
      : this.matchDynamicRoute(method, url.pathname);
    const handler = exactRoute?.handler ?? dynamicMatch?.handler;
    const matchingDescriptors = this.descriptors.filter((descriptor) => (
      this.routeMatchesPathname(descriptor.pathname, url.pathname)
    ));
    if (!handler && method === "OPTIONS") {
      const corsPreflight = await buildBearerCorsPreflight(
        request,
        matchingDescriptors,
      );
      if (corsPreflight) {
        return corsPreflight;
      }
      const allowedMethods = matchingDescriptors
        .map((descriptor) => descriptor.method);
      if (allowedMethods.length > 0) {
        return new Response(null, {
          status: 204,
          headers: {
            allow: [...new Set([...allowedMethods, "OPTIONS"])]
              .sort()
              .join(", "),
          },
        });
      }
    }
    if (!handler) {
      return jsonError(404, {
        code: "route.not_found",
        message: `No runtime route registered for ${method} ${url.pathname}.`,
        surface: context.surface,
      });
    }

    try {
      const response = await handler(request, dynamicMatch ? {
        ...context,
        params: {
          ...context.params,
          ...dynamicMatch.params,
        },
      } : context);
      const descriptor = exactRoute ?? this.dynamicRoutes.find((route) => (
        route.handler === handler
        && route.method === method
        && this.routeMatchesPathname(route.pathname, url.pathname)
      ));
      return descriptor
        ? attachBearerCors(request, response, descriptor)
        : response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(500, {
        code: "route.failed",
        message,
        surface: context.surface,
      });
    }
  }

  private routeMatchesPathname(pattern: string, pathname: string) {
    const patternParts = pattern.split("/").filter(Boolean);
    const actualParts = pathname.split("/").filter(Boolean);
    return patternParts.length === actualParts.length
      && patternParts.every((part, index) => (
        part.startsWith(":") || part === actualParts[index]
      ));
  }
}

export function createOmniHttpRegistry() {
  return new OmniHttpRegistry();
}
