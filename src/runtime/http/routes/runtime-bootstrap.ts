import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import type { OmniHttpHandler } from "@/runtime/http/registry";

function readSearchParams(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0] ?? "";
  }

  return params;
}

export const handleRuntimeBootstrapRequest: OmniHttpHandler = async (request) => {
  const payload = await buildRuntimeBootstrap({
    searchParams: readSearchParams(request),
    requestHeaders: request.headers,
  });
  return Response.json(payload);
};
