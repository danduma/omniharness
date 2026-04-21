import { NextResponse } from "next/server";
import { BRIDGE_URL } from "@/server/bridge-client";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";

interface BridgeDoctorResult {
  type: string;
  status: "ok" | "warning" | "error";
  binary: boolean;
  apiKey: boolean | null;
  endpoint: boolean | null;
  message?: string;
}

export async function GET() {
  try {
    const [allSettings, doctorResponse] = await Promise.all([
      db.select().from(settings),
      fetch(`${BRIDGE_URL}/doctor`),
    ]);

    if (!doctorResponse.ok) {
      return NextResponse.json({ error: doctorResponse.statusText }, { status: doctorResponse.status });
    }

    const payload = await doctorResponse.json() as { results?: BridgeDoctorResult[] };
    const results = payload.results ?? [];
    const byType = new Map(results.map((result) => [result.type, result]));
    const { env } = hydrateRuntimeEnvFromSettings(allSettings);

    return NextResponse.json({
      workers: SUPPORTED_WORKER_TYPES.map((type) => ({
        type,
        label: WORKER_TYPE_LABELS[type],
        availability: (() => {
          const doctorAvailability = byType.get(type);
          const localAvailability = isSpawnableWorkerType(type, env);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
