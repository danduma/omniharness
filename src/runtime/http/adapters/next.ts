import { createRuntimeRequestContext, type CreateRuntimeRequestContextOptions } from "@/runtime/http/context";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { withOuterProbe } from "@/server/slow-probe";

export function adaptOmniHandlerToNext(
  handler: OmniHttpHandler,
  contextOptions: CreateRuntimeRequestContextOptions = {},
) {
  return async function handleNextRequest(request: Request) {
    const url = new URL(request.url);
    return withOuterProbe(`${request.method} ${url.pathname}`, () =>
      handler(request, createRuntimeRequestContext(contextOptions)),
    );
  };
}
