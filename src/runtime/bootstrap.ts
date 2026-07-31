import { buildAuthSessionState } from "@/server/auth/session-state";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";
import { getEventStreamCursor } from "@/server/events/named-events";
import { readSettingsState } from "@/server/settings/read";
import { buildRunnerBootstrapIdentity } from "@/server/runner/identity";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";

export type { HomeBootstrapPayload } from "@/shared/bootstrap";

type PageSearchParams = Record<string, string | string[] | undefined>;

export type RuntimeBootstrapOptions = {
  searchParams?: PageSearchParams;
  requestHeaders: Headers;
  includeInitialData?: boolean;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeParam(value: string | string[] | undefined) {
  return firstParam(value).trim() || null;
}

function buildRequestUrl(searchParams: PageSearchParams, requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    || requestHeaders.get("host")?.trim()
    || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const url = new URL(`${protocol}://${host}/`);

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value != null) {
        url.searchParams.append(key, value);
      }
    }
  }

  return url;
}

export async function buildRuntimeBootstrap({
  searchParams = {},
  requestHeaders,
  includeInitialData = true,
}: RuntimeBootstrapOptions): Promise<HomeBootstrapPayload> {
  const requestUrl = buildRequestUrl(searchParams, requestHeaders);
  const selectedRunId = normalizeParam(searchParams.run);
  const draftProjectPath = normalizeParam(searchParams.project);
  const pairTokenFromUrl = normalizeParam(searchParams.pair);

  const session = await buildAuthSessionState({
    url: requestUrl.toString(),
    headers: requestHeaders,
  });
  const appUnlocked = Boolean(session && (!session.enabled || session.authenticated));

  const [runner, [settings, initialEventState]] = await Promise.all([
    buildRunnerBootstrapIdentity(),
    appUnlocked && includeInitialData
      ? Promise.all([
        readSettingsState(),
        buildPersistedEventPayload({ selectedRunId }),
      ])
      : Promise.resolve([null, null] as const),
  ]);

  return {
    id: JSON.stringify({
      builtAt: Date.now(),
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
      sessionAuthenticated: session?.authenticated ?? false,
      eventRunCount: initialEventState?.runs?.length ?? 0,
    }),
    route: {
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
    },
    initialEventState,
    initialLastEventId: getEventStreamCursor(),
    initialQueries: {
      session,
      settings,
    },
    features: {
      // The unified worker stream is unconditionally enabled after the
      // Phase 5 cutover. The boolean is kept on the bootstrap shape so
      // older client/server pairs don't break during the rollout
      // window; future cleanup may drop it entirely.
      unifiedWorkerStream: true,
    },
    runner,
  };
}
