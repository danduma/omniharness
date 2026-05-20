import { NextRequest } from "next/server";

export function toNextRequest(request: Request) {
  return new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
  });
}
