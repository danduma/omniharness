import { normalizeReasoningEffort } from "@/shared/reasoning-effort";
import type { AgentRecord } from "./types";

export type ProviderSettingStatus = "unset" | "pending" | "effective" | "rejected" | "unknown";
export type ProviderConfigOperation = {
  setting: "model" | "effort";
  revision: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function modelValuesEqual(left: string | null, right: string | null) {
  const canonical = (value: string | null) => value?.trim().toLowerCase().replace(/^openai\//, "") || null;
  return canonical(left) === canonical(right);
}

export function providerConfigValue(options: unknown[], ids: string[]) {
  const normalizedIds = new Set(ids.map((id) => id.toLowerCase()));
  for (const option of options) {
    const item = record(option);
    if (normalizedIds.has(stringValue(item?.id)?.toLowerCase() ?? "")) {
      return stringValue(item?.currentValue);
    }
  }
  return null;
}

function operationOwnsSetting(
  record: AgentRecord,
  operation: ProviderConfigOperation | null | undefined,
  setting: ProviderConfigOperation["setting"],
) {
  if (!operation || operation.setting !== setting) return null;
  const revision = setting === "model" ? record.modelConfigRevision : record.effortConfigRevision;
  return operation.revision === revision;
}

export function applyProviderConfigOptions(
  record: AgentRecord,
  options: unknown[],
  operation?: ProviderConfigOperation | null,
) {
  const model = providerConfigValue(options, ["model"]);
  if (
    (!operation || operation.setting === "model")
    && options.some((option) => stringValue(recordOption(option)?.id)?.toLowerCase() === "model")
  ) {
    const operationOwnsModel = operationOwnsSetting(record, operation, "model");
    if (operationOwnsModel !== false) {
      const requestedModel = record.pendingModel ?? record.requestedModel;
      record.effectiveModel = model;
      const confirmed = Boolean(requestedModel && modelValuesEqual(model, requestedModel));
      if (record.pendingModel && operationOwnsModel === null && !confirmed) {
        record.modelStatus = "pending";
      } else {
        record.pendingModel = null;
        record.rejectedModel = requestedModel && !modelValuesEqual(model, requestedModel) ? requestedModel : null;
        record.modelStatus = record.rejectedModel ? "rejected" : model ? "effective" : "unknown";
      }
    }
  }

  const effortOptionPresent = options.some((option) => {
    const id = stringValue(recordOption(option)?.id)?.toLowerCase();
    return id === "effort" || id === "reasoning_effort";
  });
  if (effortOptionPresent && (!operation || operation.setting === "effort")) {
    const operationOwnsEffort = operationOwnsSetting(record, operation, "effort");
    if (operationOwnsEffort === false) return;
    const requestedEffort = record.pendingEffort ?? record.requestedEffort;
    const effort = normalizeReasoningEffort(providerConfigValue(options, ["effort", "reasoning_effort"]));
    record.effectiveEffort = effort;
    const confirmed = Boolean(requestedEffort && effort === requestedEffort);
    if (record.pendingEffort && operationOwnsEffort === null && !confirmed) {
      record.effortStatus = "pending";
    } else {
      record.pendingEffort = null;
      record.rejectedEffort = requestedEffort && effort !== requestedEffort ? requestedEffort : null;
      record.effortStatus = record.rejectedEffort ? "rejected" : effort ? "effective" : "unknown";
    }
  }
}

function recordOption(value: unknown) {
  return record(value);
}

export function beginProviderConfigChange(record: AgentRecord, configId: string, value: string): ProviderConfigOperation | null {
  const id = configId.trim().toLowerCase();
  if (id === "model") {
    record.requestedModel = value;
    record.pendingModel = value;
    record.rejectedModel = null;
    record.modelStatus = "pending";
    record.modelConfigRevision = (record.modelConfigRevision ?? 0) + 1;
    return { setting: "model", revision: record.modelConfigRevision };
  } else if (id === "effort" || id === "reasoning_effort") {
    const effort = normalizeReasoningEffort(value);
    record.requestedEffort = effort;
    record.pendingEffort = effort;
    record.rejectedEffort = null;
    record.effortStatus = "pending";
    record.effortConfigRevision = (record.effortConfigRevision ?? 0) + 1;
    return { setting: "effort", revision: record.effortConfigRevision };
  }
  return null;
}

export function markProviderConfigUnconfirmed(record: AgentRecord, configId: string, operation?: ProviderConfigOperation | null) {
  const id = configId.trim().toLowerCase();
  if (id === "model") {
    if (operationOwnsSetting(record, operation, "model") === false) return;
    if (record.pendingModel && record.effectiveModel !== record.pendingModel) record.effectiveModel = null;
    record.pendingModel = null;
    record.modelStatus = modelValuesEqual(record.effectiveModel, record.requestedModel) ? "effective" : "unknown";
  } else if (id === "effort" || id === "reasoning_effort") {
    if (operationOwnsSetting(record, operation, "effort") === false) return;
    if (record.pendingEffort && record.effectiveEffort !== record.pendingEffort) record.effectiveEffort = null;
    record.pendingEffort = null;
    record.effortStatus = record.effectiveEffort === record.requestedEffort ? "effective" : "unknown";
  }
}

export function rejectProviderConfigChange(record: AgentRecord, configId: string, operation?: ProviderConfigOperation | null) {
  const id = configId.trim().toLowerCase();
  if (id === "model") {
    if (operationOwnsSetting(record, operation, "model") === false) return;
    record.rejectedModel = record.pendingModel;
    record.pendingModel = null;
    record.modelStatus = "rejected";
  } else if (id === "effort" || id === "reasoning_effort") {
    if (operationOwnsSetting(record, operation, "effort") === false) return;
    record.rejectedEffort = record.pendingEffort;
    record.pendingEffort = null;
    record.effortStatus = "rejected";
  }
}
