import { headers } from "next/headers";
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";

export type { HomeBootstrapPayload };

type PageSearchParams = Record<string, string | string[] | undefined>;

export async function buildHomeBootstrap(searchParams: PageSearchParams = {}): Promise<HomeBootstrapPayload> {
  const requestHeaders = await headers();
  return buildRuntimeBootstrap({ searchParams, requestHeaders, includeInitialData: false });
}
