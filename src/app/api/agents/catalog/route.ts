import { NextRequest, NextResponse } from "next/server";
import { BRIDGE_URL } from "@/server/bridge-client";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
import { buildAppError, errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { buildWorkerModelCatalog } from "@/server/worker-models";

interface BridgeDoctorResult {
  type: string;
  status: "ok" | "warning" | "error";
  binary: boolean;
  apiKey: boolean | null;
  endpoint: boolean | null;
  message?: string;
}

export async function GET(req?: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Bridge",
      action: "Load worker availability",
    });
    if (auth.response) {
      return auth.response;
    }

    const [allSettings, doctorResponse, workerModels] = await Promise.all([
      db.select().from(settings),
      fetch(`${BRIDGE_URL}/doctor`),
      buildWorkerModelCatalog(),
    ]);

    if (!doctorResponse.ok) {
      return errorResponse(`Bridge doctor request failed with status ${doctorResponse.status}`, {
        status: doctorResponse.status,
        source: "Bridge",
        action: "Load worker availability",
      });
    }

    const payload = await doctorResponse.json() as { results?: BridgeDoctorResult[] };
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
      workerModels,
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
            message: localAvailability.reason || "Bridge doctor did not report this worker type.",
          };
        })(),
      })),
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Bridge",
      action: "Load worker availability",
    });
  }
}
