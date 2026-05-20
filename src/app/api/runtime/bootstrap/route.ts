import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";

function readSearchParams(request: NextRequest) {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0] ?? "";
  }

  return params;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await buildRuntimeBootstrap({
      searchParams: readSearchParams(request),
      requestHeaders: request.headers,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Runtime",
      action: "Load bootstrap",
    });
  }
}
