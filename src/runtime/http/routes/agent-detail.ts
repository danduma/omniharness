import { eq } from "drizzle-orm";
import { getAgent, getAgentOutput, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { formatErrorMessage } from "@/server/runs/failures";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

const FULL_HISTORY_ENTRY_LIMIT = 20_000;
const HISTORY_ENTRY_TEXT_LIMIT = 20_000;
const HISTORY_RAW_STRING_LIMIT = 20_000;
const HISTORY_RAW_JSON_LIMIT = 80_000;
const HISTORY_TOOL_ENTRY_TEXT_LIMIT = 2_000;
const HISTORY_TOOL_RAW_STRING_LIMIT = 8_000;
const HISTORY_MESSAGE_CHUNK_MAX_GAP_MS = 3_000;

function isMissingAgentError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("404") || message.includes("not_found") || message.includes("agent not found");
}

type WorkerOutputEntry = NonNullable<AgentRecord["outputEntries"]>[number];

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}

[Truncated ${value.length - limit} characters while loading worker history]`;
}

function compactRawValue(value: unknown, stringLimit = HISTORY_RAW_STRING_LIMIT, depth = 0): unknown {
  if (typeof value === "string") {
    return truncateText(value, stringLimit);
  }

  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= 8) {
    return "[Truncated nested raw worker history payload]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => compactRawValue(item, stringLimit, depth + 1));
  }

  if (typeof value === "object") {
    const compacted = Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        compactRawValue(nestedValue, stringLimit, depth + 1),
      ]),
    );
    const serialized = JSON.stringify(compacted);
    return serialized.length <= HISTORY_RAW_JSON_LIMIT
      ? compacted
      : "[Truncated raw worker history payload]";
  }

  return String(value);
}

function compactHistoryEntry(entry: WorkerOutputEntry): WorkerOutputEntry {
  const isToolEntry = entry.type === "tool_call" || entry.type === "tool_call_update" || entry.type === "permission";
  return {
    ...entry,
    text: truncateText(entry.text, isToolEntry ? HISTORY_TOOL_ENTRY_TEXT_LIMIT : HISTORY_ENTRY_TEXT_LIMIT),
    raw: entry.raw === undefined
      ? undefined
      : compactRawValue(entry.raw, isToolEntry ? HISTORY_TOOL_RAW_STRING_LIMIT : HISTORY_RAW_STRING_LIMIT),
  };
}

function timestampMs(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldCoalesceHistoryEntry(previous: WorkerOutputEntry, next: WorkerOutputEntry) {
  if (previous.type !== next.type || (next.type !== "message" && next.type !== "thought")) {
    return false;
  }

  return timestampMs(next.timestamp) - timestampMs(previous.timestamp) <= HISTORY_MESSAGE_CHUNK_MAX_GAP_MS;
}

function coalesceHistoryEntries(entries: WorkerOutputEntry[]) {
  const coalesced: WorkerOutputEntry[] = [];

  for (const entry of entries) {
    const previous = coalesced[coalesced.length - 1];
    if (previous && shouldCoalesceHistoryEntry(previous, entry)) {
      coalesced[coalesced.length - 1] = {
        ...previous,
        text: truncateText(`${previous.text}${entry.text}`, HISTORY_ENTRY_TEXT_LIMIT),
      };
      continue;
    }

    coalesced.push(entry);
  }

  return coalesced;
}

async function loadAgentWithOptionalHistory(name: string, includeFullHistory: boolean) {
  const data = await getAgent(name);
  if (!includeFullHistory) {
    return data;
  }

  const archive = await getAgentOutput(name, { limit: FULL_HISTORY_ENTRY_LIMIT });
  return {
    ...data,
    outputEntries: coalesceHistoryEntries(archive.entries).map(compactHistoryEntry),
  };
}

export const handleAgentDetailRequest: OmniHttpHandler = async (request, context) => {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Agent runtime",
    action: "Load worker details",
  });
  if (auth.response) {
    return auth.response;
  }

  const name = context.params?.name;
  if (!name) {
    return errorResponse("Worker name is required.", {
      status: 400,
      source: "Agent runtime",
      action: "Load worker details",
    });
  }

  const worker = await db.select().from(workers).where(eq(workers.id, name)).get();
  const run = worker ? await db.select().from(runs).where(eq(runs.id, worker.runId)).get() : null;
  const includeFullHistory = new URL(request.url).searchParams.get("history") === "full";
  const workerWithEntries = worker
    ? { ...worker, outputEntries: await readWorkerOutputEntries(worker.runId, worker.id) }
    : null;

  try {
    const data = await loadAgentWithOptionalHistory(name, includeFullHistory);
    return Response.json(buildLiveWorkerSnapshot({
      agent: data,
      worker: workerWithEntries,
      run,
    }));
  } catch (error: unknown) {
    if (workerWithEntries && isMissingAgentError(error)) {
      return Response.json(buildLiveWorkerSnapshot({
        worker: workerWithEntries,
        run,
        bridgeError: error,
      }));
    }

    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Load worker details",
    });
  }
};
