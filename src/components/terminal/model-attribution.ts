/**
 * Per-message model/effort attribution for the conversation transcript.
 *
 * The only witness to what a session was actually running is the session's own
 * config, which the runtime writes into the worker stream as a `config_option`
 * entry — once at session start, and again after every
 * `session/set_config_option`. Because a model or effort change recreates the
 * worker, every change lands as a fresh `config_option` row in the same stream,
 * so scanning the stream in order attributes each message to the state that was
 * in effect when it was written.
 *
 * Nothing here guesses. A message with no evidence in the loaded window gets no
 * attribution rather than an attribution borrowed from a neighbour — labelling a
 * message with a model that never produced it is worse than labelling nothing.
 */
import { t } from "@/lib/i18n";
import { resolveComposerEffortLabel } from "@/interface/home/utils";
import { formatSessionModelLabel } from "@/shared/model-label";
import type { WorkerEntry } from "@/shared/worker-entries";

export type MessageModelAttribution = {
  model: string | null;
  effort: string | null;
};

/** The live worker's current selection, used only where the window has no `config_option` at all. */
export type MessageModelAttributionFallback = {
  workerId: string | null;
  model: string | null;
  effort: string | null;
};

type AttributionEntry = Pick<WorkerEntry, "id" | "type" | "raw"> & { workerId?: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Read the model and effort selections out of a `config_option` payload.
 *
 * Config ids come from the CLI, not from us: Claude reports `effort`, older
 * Codex adapters report `reasoning_effort`. Anything else in the payload (mode,
 * permissions) is not attribution and is ignored.
 */
export function readConfigOptionSelections(raw: unknown): MessageModelAttribution | null {
  const options = asRecord(raw)?.configOptions;
  if (!Array.isArray(options)) {
    return null;
  }

  let model: string | null = null;
  let effort: string | null = null;
  for (const option of options) {
    const record = asRecord(option);
    const id = asNonEmptyString(record?.id)?.toLowerCase();
    const value = asNonEmptyString(record?.currentValue);
    if (!id || !value) {
      continue;
    }
    if (id === "model") {
      model = value;
    } else if (id === "effort" || id === "reasoning_effort") {
      effort = value;
    }
  }

  return model || effort ? { model, effort } : null;
}

export function buildMessageModelAttribution(
  entries: ReadonlyArray<AttributionEntry>,
  fallback?: MessageModelAttributionFallback | null,
): Map<string, MessageModelAttribution> {
  const fallbackWorkerKey = fallback?.workerId ?? "";
  const workerKeyOf = (entry: AttributionEntry) => entry.workerId ?? fallbackWorkerKey;

  // Workers whose config is observable somewhere in this window. The fallback
  // is only sound where it is not: a window that contains a `config_option` has
  // a change in it, and messages written before that change ran under settings
  // that scrolled out of view.
  const workersWithObservedConfig = new Set<string>();
  for (const entry of entries) {
    if (entry.type === "config_option" && readConfigOptionSelections(entry.raw)) {
      workersWithObservedConfig.add(workerKeyOf(entry));
    }
  }

  const fallbackAttribution: MessageModelAttribution | null = fallback && (fallback.model || fallback.effort)
    ? { model: fallback.model ?? null, effort: fallback.effort ?? null }
    : null;

  const currentByWorker = new Map<string, MessageModelAttribution>();
  const attributionByEntryId = new Map<string, MessageModelAttribution>();
  for (const entry of entries) {
    const workerKey = workerKeyOf(entry);
    if (entry.type === "config_option") {
      const selections = readConfigOptionSelections(entry.raw);
      if (!selections) {
        continue;
      }
      // Merge rather than replace: a `set_config_option` response is only
      // guaranteed to describe the option that changed.
      const previous = currentByWorker.get(workerKey);
      currentByWorker.set(workerKey, {
        model: selections.model ?? previous?.model ?? null,
        effort: selections.effort ?? previous?.effort ?? null,
      });
      continue;
    }

    if (entry.type !== "message") {
      continue;
    }

    const observed = currentByWorker.get(workerKey);
    const attribution = observed
      ?? (workersWithObservedConfig.has(workerKey) || workerKey !== fallbackWorkerKey ? null : fallbackAttribution);
    if (attribution) {
      attributionByEntryId.set(entry.id, attribution);
    }
  }

  return attributionByEntryId;
}

/** "Opus 5 (High)" — the model that produced the message, never the harness that ran it. */
export function formatMessageModelAttribution(
  model: string | null | undefined,
  effort: string | null | undefined,
) {
  const modelLabel = formatSessionModelLabel(model);
  if (!modelLabel) {
    return null;
  }

  const effortLabel = resolveComposerEffortLabel(effort);
  return effortLabel
    ? t("conversation.message.modelEffort", { model: modelLabel, effort: effortLabel })
    : modelLabel;
}
