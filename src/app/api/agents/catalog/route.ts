import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { BRIDGE_URL } from "@/server/bridge-client";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
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

const WORKER_MODEL_CATALOG_CACHE_KEY = "__WORKER_MODEL_CATALOG_CACHE";

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Agent runtime",
      action: "Load worker availability",
    });
    if (auth.response) {
      return auth.response;
    }

    const [allSettings, doctorResponse, workerModelSnapshot] = await Promise.all([
      db.select().from(settings),
      fetch(`${BRIDGE_URL}/doctor`),
      workerModelCatalogManager.getCatalogSnapshot({ refreshOnFirstLoad: true }),
    ]);

    if (!doctorResponse.ok) {
      return errorResponse(`Agent runtime doctor request failed with status ${doctorResponse.status}`, {
        status: doctorResponse.status,
        source: "Agent runtime",
        action: "Load worker availability",
      });
    }

    const payload = await doctorResponse.json() as { results?: RuntimeDoctorResult[] };
    const results = payload.results ?? [];
    const byType = new Map(results.map((result) => [result.type, result]));
    const { decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);

    return NextResponse.json({
      diagnostics: decryptionFailures.map((failure) => buildAppError(
        `Unable to decrypt runtime setting "${failure.key}".`,
        {
          source: "Settings",
          action: "Load worker availability",
        },
      )),
      workerModels: workerModelSnapshot.catalog,
      workerModelsRefreshing: workerModelSnapshot.refreshing,
      workers: SUPPORTED_WORKER_TYPES.map((type) => ({
        type,
        label: WORKER_TYPE_LABELS[type],
        availability: (() => {
          const doctorAvailability = byType.get(type);
          const localAvailability = isSpawnableWorkerType(type);

          if (localAvailability.ok) {
            return {
              type,
              status: "ok" as const,
              binary: true,
              apiKey: true,
              endpoint: doctorAvailability?.endpoint ?? null,
              message: "Ready to spawn.",
            };
          }

          return doctorAvailability ?? {
            type,
            status: "warning",
            binary: false,
            apiKey: null,
            endpoint: null,
            message: localAvailability.reason || "Agent runtime doctor did not report this worker type.",
          };
        })(),
      })),
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Load worker availability",
    });
  }
}
