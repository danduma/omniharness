import { createRuntimeRequestContext, type CreateRuntimeRequestContextOptions } from "@/runtime/http/context";
import type { OmniHttpHandler } from "@/runtime/http/registry";

export function adaptOmniHandlerToNext(
  handler: OmniHttpHandler,
  contextOptions: CreateRuntimeRequestContextOptions = {},
) {
  return async function handleNextRequest(request: Request) {
    return handler(request, createRuntimeRequestContext(contextOptions));
  };
}
