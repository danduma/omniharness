import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import {
  DECISION_SETTING_KEYS,
  DEFAULT_DECISION_MODEL,
  parseDecisionPoints,
  parseDecisionTextTasks,
  type DecisionLayerStatus,
  type DecisionPointId,
  type DecisionTextTaskId,
} from "@/shared/decision-layer";

export type DecisionLayerConfig = {
  enabled: boolean;
  model: string;
  escalationModel: string | null;
  zeroDataRetention: boolean;
  points: ReadonlySet<DecisionPointId>;
  /** Subset of `points` allowed to act; every other enabled point is shadow-only. */
  actingPoints: ReadonlySet<DecisionPointId>;
  /** Fast text model; null keeps every text task on its existing path. */
  textModel: string | null;
  textTasks: ReadonlySet<DecisionTextTaskId>;
  /** From the runner environment only; never read from the settings table. */
  apiKey: string | null;
  baseUrl: string | null;
};

type EnvLike = Record<string, string | undefined>;

function isTrue(value: string | undefined) {
  return (value ?? "").trim().toLowerCase() === "true";
}

export function decisionConfigFromValues(values: Record<string, string>, env: EnvLike): DecisionLayerConfig {
  const points = new Set(parseDecisionPoints(values[DECISION_SETTING_KEYS.points]));
  return {
    enabled: isTrue(values[DECISION_SETTING_KEYS.enabled]),
    model: values[DECISION_SETTING_KEYS.model]?.trim() || DEFAULT_DECISION_MODEL,
    escalationModel: values[DECISION_SETTING_KEYS.escalationModel]?.trim() || null,
    zeroDataRetention: isTrue(values[DECISION_SETTING_KEYS.zeroDataRetention]),
    points,
    // Acting is opt-in per point and only for points that are enabled at all.
    actingPoints: new Set(parseDecisionPoints(values[DECISION_SETTING_KEYS.actingPoints]).filter((point) => points.has(point))),
    textModel: values[DECISION_SETTING_KEYS.textModel]?.trim() || null,
    textTasks: new Set(parseDecisionTextTasks(values[DECISION_SETTING_KEYS.textTasks])),
    apiKey: env.AI_GATEWAY_API_KEY?.trim() || null,
    baseUrl: env.AI_GATEWAY_BASE_URL?.trim() || null,
  };
}

export async function loadDecisionLayerConfig(env: EnvLike = process.env): Promise<DecisionLayerConfig> {
  const keys = new Set<string>(Object.values(DECISION_SETTING_KEYS));
  const rows = await db.select().from(settings);
  const values = Object.fromEntries(rows.filter((row) => keys.has(row.key)).map((row) => [row.key, row.value]));
  return decisionConfigFromValues(values, env);
}

export function readDecisionLayerStatus(env: EnvLike = process.env): DecisionLayerStatus {
  const configured = Boolean(env.AI_GATEWAY_API_KEY?.trim());
  return { gatewayKeyConfigured: configured, gatewayKeySource: configured ? "env" : "none" };
}
