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

/**
 * The mode a worker launches or resumes in. A permission mode the user picked
 * for the conversation wins outright (including `auto`, which is a real Claude
 * and Codex mode there). Otherwise the worker keeps the mode its session last
 * reported, and a worker with no recorded mode follows the YOLO setting.
 */
export function resolveWorkerLaunchMode(
  requestedMode: unknown,
  yoloModeEnabled: boolean,
  preferredPermissionMode?: string | null,
) {
  const preferred = preferredPermissionMode?.trim();
  if (preferred) {
    return preferred;
  }
  return normalizeRequestedMode(requestedMode) ?? (yoloModeEnabled ? "full-access" : undefined);
}

export async function readWorkerYoloModeEnabled(defaultValue = true) {
  const allSettings = await db.select().from(settings);
  const settingValues = new Map(allSettings.map((setting) => [setting.key, setting.value]));
  const stored = settingValues.get(WORKER_YOLO_MODE_SETTING);
  return parseBooleanSetting(typeof stored === "string" ? stored : null, defaultValue);
}
