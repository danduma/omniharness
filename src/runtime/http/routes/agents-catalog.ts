import { eq } from "drizzle-orm";
import { BRIDGE_URL } from "@/server/bridge-client";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { resolveCommand, withManagedPath } from "@/server/agent-runtime/tool-env";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { getWorkerAuthenticationInfo, getWorkerInstallationInfo, getWorkerTokenQuotaInfo, isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import type { WorkerCommandResolver, WorkerCommandRunner } from "@/server/supervisor/worker-availability";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
import { buildAppError, errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { WorkerModelCatalogManager, type WorkerModelCatalog } from "@/server/worker-models";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

interface RuntimeDoctorResult {
  type: string;
  status: "ok" | "warning" | "error";
  binary: boolean;
  apiKey: boolean | null;
  endpoint: boolean | null;
  message?: string;
}

interface RuntimeDoctorSnapshot {
  results: RuntimeDoctorResult[];
  diagnostic: ReturnType<typeof buildAppError> | null;
}

const WORKER_MODEL_CATALOG_CACHE_KEY = "__WORKER_MODEL_CATALOG_CACHE";
const RUNTIME_DOCTOR_TIMEOUT_MS = 2_000;

const frontendCatalogCommandRunner: WorkerCommandRunner = () => {
  throw new Error("Frontend catalog requests skip blocking CLI probes.");
};

const frontendCatalogCommandResolver: WorkerCommandResolver = (command, env) => {
  const managedEnv = withManagedPath(env, undefined, { loginShellPathMode: "cached" });
  return resolveCommand(command, { env: managedEnv });
};

const workerModelCatalogManager = new WorkerModelCatalogManager({
  loadCachedCatalog: async () => {
    const cached = await db.select().from(settings).where(eq(settings.key, WORKER_MODEL_CATALOG_CACHE_KEY)).get();
    if (!cached?.value) {
      return null;
    }

    const parsed = JSON.parse(cached.value) as unknown;
    if (parsed && typeof parsed === "object" && "catalog" in parsed) {
      return (parsed as { catalog?: Partial<WorkerModelCatalog> }).catalog ?? null;
    }

    return parsed as Partial<WorkerModelCatalog>;
  },
  saveCachedCatalog: async (catalog) => {
    const cachedValue = JSON.stringify({ catalog, updatedAt: new Date().toISOString() });
    await db.insert(settings)
      .values({
        key: WORKER_MODEL_CATALOG_CACHE_KEY,
        value: cachedValue,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: cachedValue,
          updatedAt: new Date(),
        },
      });
  },
});

async function fetchRuntimeDoctor(options: { refresh?: boolean } = {}) {
  const controller = new AbortController();
  let didTimeout = false;
  const doctorUrl = new URL(`${BRIDGE_URL}/doctor`);
  if (options.refresh) {
    doctorUrl.searchParams.set("refresh", "1");
  }
  const timeout = options.refresh ? null : setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, RUNTIME_DOCTOR_TIMEOUT_MS);

  try {
    return await fetch(doctorUrl, { signal: controller.signal });
  } catch (error) {
    if (didTimeout) {
      throw new Error(`Agent runtime doctor request timed out after ${RUNTIME_DOCTOR_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function readRuntimeDoctorSnapshot(options: { refresh?: boolean } = {}): Promise<RuntimeDoctorSnapshot> {
  try {
    const doctorResponse = await fetchRuntimeDoctor(options);
    if (!doctorResponse.ok) {
      return {
        results: [],
        diagnostic: buildAppError(`Agent runtime doctor request failed with status ${doctorResponse.status}`, {
          status: doctorResponse.status,
          source: "Agent runtime",
          action: "Load worker availability",
        }),
      };
    }

    const payload = await doctorResponse.json() as { results?: RuntimeDoctorResult[] };
    return {
      results: payload.results ?? [],
      diagnostic: null,
    };
  } catch (error) {
    return {
      results: [],
      diagnostic: buildAppError(error, {
        source: "Agent runtime",
        action: "Load worker availability",
      }),
    };
  }
}

export const handleAgentsCatalogRequest: OmniHttpHandler = async (request) => {
  try {
    const auth = await requireApiSession(toNextRequest(request), {
      source: "Agent runtime",
      action: "Load worker availability",
    });
    if (auth.response) {
      return auth.response;
    }

    const requestUrl = new URL(request.url);
    const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
    const [allSettings, doctorSnapshot, workerModelSnapshot] = await Promise.all([
      db.select().from(settings),
      readRuntimeDoctorSnapshot({ refresh: forceRefresh }),
      workerModelCatalogManager.getCatalogSnapshot({ refreshOnFirstLoad: true }),
    ]);

    const byType = new Map(doctorSnapshot.results.map((result) => [result.type, result]));
    const { env: runtimeSettingsEnv, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const workerDetectionEnv = {
      ...process.env,
      ...runtimeSettingsEnv,
    };

    return Response.json({
      diagnostics: [
        ...decryptionFailures.map((failure) => buildAppError(
          `Unable to decrypt runtime setting "${failure.key}".`,
          {
            source: "Settings",
            action: "Load worker availability",
          },
        )),
        ...(doctorSnapshot.diagnostic ? [doctorSnapshot.diagnostic] : []),
      ],
      workerModels: workerModelSnapshot.catalog,
      workerModelsRefreshing: workerModelSnapshot.refreshing,
      workers: SUPPORTED_WORKER_TYPES.map((type) => {
        const detectionOptions = {
          env: workerDetectionEnv,
          commandResolver: frontendCatalogCommandResolver,
        };
        const installation = getWorkerInstallationInfo(type, detectionOptions);
        const authentication = getWorkerAuthenticationInfo(type, {
          env: workerDetectionEnv,
          commandRunner: frontendCatalogCommandRunner,
        });
        return {
          type,
          label: WORKER_TYPE_LABELS[type],
          installation,
          authentication,
          tokenQuota: getWorkerTokenQuotaInfo(type, {
            env: workerDetectionEnv,
            commandRunner: frontendCatalogCommandRunner,
          }),
          availability: (() => {
            const doctorAvailability = byType.get(type);
            const localAvailability = isSpawnableWorkerType(type, detectionOptions);

            if (localAvailability.ok) {
              if (authentication.status === "not_authenticated") {
                return {
                  type,
                  status: "warning" as const,
                  binary: true,
                  apiKey: false,
                  endpoint: doctorAvailability?.endpoint ?? null,
                  message: authentication.message,
                };
              }

              return {
                type,
                status: "ok" as const,
                binary: true,
                apiKey: authentication.status === "authenticated" ? true : null,
                endpoint: doctorAvailability?.endpoint ?? null,
                message: "Ready to spawn.",
              };
            }

            if (doctorAvailability?.status === "ok" && doctorAvailability.binary) {
              if (authentication.status === "not_authenticated") {
                return {
                  ...doctorAvailability,
                  status: "warning" as const,
                  apiKey: false,
                  message: authentication.message,
                };
              }

              return {
                ...doctorAvailability,
                apiKey: authentication.status === "authenticated" ? true : doctorAvailability.apiKey,
                message: doctorAvailability.message || "Ready to spawn.",
              };
            }

            return doctorAvailability ?? {
              type,
              status: "warning",
              binary: Boolean(installation.path),
              apiKey: null,
              endpoint: null,
              message: localAvailability.reason || "Agent runtime doctor did not report this worker type.",
            };
          })(),
        };
      }),
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Load worker availability",
    });
  }
};
