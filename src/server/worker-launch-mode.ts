import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { parseBooleanSetting } from "@/lib/commit-workflow";

const WORKER_YOLO_MODE_SETTING = "WORKER_YOLO_MODE";

function normalizeRequestedMode(requestedMode: unknown) {
  if (typeof requestedMode !== "string") {
    return undefined;
  }

  const normalized = requestedMode.trim();
  if (!normalized || normalized === "auto" || normalized === "direct") {
    return undefined;
  }

  return normalized;
}

export function resolveWorkerLaunchMode(requestedMode: unknown, yoloModeEnabled: boolean) {
  return normalizeRequestedMode(requestedMode) ?? (yoloModeEnabled ? "full-access" : undefined);
}

export async function readWorkerYoloModeEnabled(defaultValue = true) {
  const allSettings = await db.select().from(settings);
  const settingValues = new Map(allSettings.map((setting) => [setting.key, setting.value]));
  return parseBooleanSetting(settingValues.get(WORKER_YOLO_MODE_SETTING), defaultValue);
}
