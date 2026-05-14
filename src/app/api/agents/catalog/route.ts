import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { BRIDGE_URL } from "@/server/bridge-client";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { getWorkerAuthenticationInfo, getWorkerInstallationInfo, getWorkerTokenQuotaInfo, isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
import { buildAppError, errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { WorkerModelCatalogManager, type WorkerModelCatalog } from "@/server/worker-models";

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Agent runtime",
      action: "Load worker availability",
    });
    if (auth.response) {
      return auth.response;
    }

    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    const [allSettings, doctorSnapshot, workerModelSnapshot] = await Promise.all([
      db.select().from(settings),
      readRuntimeDoctorSnapshot({ refresh: forceRefresh }),
      workerModelCatalogManager.getCatalogSnapshot({ refreshOnFirstLoad: true }),
    ]);

    const results = doctorSnapshot.results;
    const byType = new Map(results.map((result) => [result.type, result]));
    const { env: runtimeSettingsEnv, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const workerDetectionEnv = {
      ...process.env,
      ...runtimeSettingsEnv,
    };

    return NextResponse.json({
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
        const installation = getWorkerInstallationInfo(type, { env: workerDetectionEnv });
        const authentication = getWorkerAuthenticationInfo(type, { env: workerDetectionEnv });
        return {
          type,
          label: WORKER_TYPE_LABELS[type],
          installation,
          authentication,
          tokenQuota: getWorkerTokenQuotaInfo(type, { env: workerDetectionEnv }),
          availability: (() => {
            const doctorAvailability = byType.get(type);
            const localAvailability = isSpawnableWorkerType(type, { env: workerDetectionEnv });

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
}
