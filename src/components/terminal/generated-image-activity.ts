import type { WorkerEntry } from "@/shared/worker-entries";
import type { WorkerEntryContentReference } from "@/interface/home/WorkerEntryContentUrlManager";

export type GeneratedImageItem = {
  id: string;
  mimeType: string;
  data?: string;
  reference?: WorkerEntryContentReference;
  /**
   * True only when the originating tool actually produced the image. Most
   * images in a transcript are files the agent opened — screenshots, mockups,
   * assets — so the gallery must not claim they were generated.
   */
  generated: boolean;
  /** File name of the image the tool read, when the call named one. */
  name?: string;
};

export type GeneratedImagesActivity = {
  id: string;
  kind: "generated_images";
  timestamp: string;
  streamSeq?: number;
  images: GeneratedImageItem[];
};

const TURN_BOUNDARY_TYPES = new Set([
  "user_input",
  "supervisor_input",
  "user_message_chunk",
]);

// Codex titles its image tool "Image generation"; other agents surface names
// like `generate_image` or `dalle`. Anything that does not match is treated as
// a plain image the agent obtained, which is the safe claim to make.
const IMAGE_GENERATION_PATTERN = /image[\s_-]*generation|generat\w*[\s_-]*images?\b|creat\w*[\s_-]*images?\b|dall[\s._-]*e|imagen|midjourney/i;

type ImageToolCall = {
  title: string;
  toolName?: string;
  kind?: string;
  path?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** The file path a read-style tool call names, in either place ACP puts it. */
function toolCallPath(raw: Record<string, unknown> | null) {
  const fromInput = asNonEmptyString(asRecord(raw?.rawInput)?.file_path);
  if (fromInput) {
    return fromInput;
  }
  const locations = Array.isArray(raw?.locations) ? raw.locations : [];
  return asNonEmptyString(asRecord(locations[0])?.path);
}

function readToolCall(entry: WorkerEntry): ImageToolCall {
  const raw = asRecord(entry.raw);
  return {
    title: entry.text,
    toolName: asNonEmptyString(asRecord(asRecord(raw?._meta)?.claudeCode)?.toolName),
    kind: entry.toolKind ?? asNonEmptyString(raw?.kind),
    path: toolCallPath(raw),
  };
}

/**
 * Merge a later `tool_call_update` over the pending `tool_call`. The pending
 * record carries a placeholder title ("Read File") and no path; the update
 * carries both, but a completion-only update carries neither.
 */
function mergeToolCall(previous: ImageToolCall | undefined, next: ImageToolCall): ImageToolCall {
  if (!previous) {
    return next;
  }
  return {
    title: next.path ? next.title : previous.title,
    toolName: next.toolName ?? previous.toolName,
    kind: next.kind ?? previous.kind,
    path: next.path ?? previous.path,
  };
}

function isFileReadToolCall(tool: ImageToolCall) {
  return tool.kind === "read" || /^read\b/i.test(tool.toolName ?? "");
}

function isGeneratedByToolCall(tool: ImageToolCall | undefined) {
  if (!tool || isFileReadToolCall(tool)) {
    return false;
  }
  return IMAGE_GENERATION_PATTERN.test(`${tool.toolName ?? ""} ${tool.title}`);
}

function fileName(path: string | undefined) {
  return path?.split(/[\\/]/).pop() || undefined;
}

function entryWorkerId(entry: WorkerEntry, fallbackWorkerId: string | undefined) {
  const candidate = (entry as WorkerEntry & { workerId?: unknown }).workerId;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : fallbackWorkerId;
}

/**
 * Project image protocol entries into one stable gallery per user turn. The
 * worker stream remains the persistence authority; this is only a display
 * projection over the loaded window.
 *
 * Images reach the transcript from any tool that returns image content, and in
 * practice most of them are screenshots the agent read back rather than
 * anything it generated, so each item records which one it is.
 */
export function buildGeneratedImagesActivity(
  entries: readonly WorkerEntry[],
  fallbackWorkerId?: string,
): GeneratedImagesActivity[] {
  const turnByWorker = new Map<string, string>();
  const galleries = new Map<string, GeneratedImagesActivity>();
  // The runtime appends a tool call's content entries after the call record
  // that produced them, so a single forward pass always knows the origin of
  // the image it is looking at.
  const toolCalls = new Map<string, ImageToolCall>();

  for (const entry of entries) {
    const owner = entryWorkerId(entry, fallbackWorkerId) ?? "unowned";
    if (TURN_BOUNDARY_TYPES.has(entry.type)) {
      turnByWorker.set(owner, entry.id);
      continue;
    }
    if (entry.type === "tool_call" || entry.type === "tool_call_update") {
      if (entry.toolCallId) {
        toolCalls.set(
          entry.toolCallId,
          mergeToolCall(toolCalls.get(entry.toolCallId), readToolCall(entry)),
        );
      }
      continue;
    }
    if (entry.type !== "agent_content") {
      continue;
    }

    const raw = asRecord(entry.raw);
    const content = asRecord(raw?.content);
    if (content?.type !== "image") {
      continue;
    }

    const turnId = turnByWorker.get(owner) ?? `before-loaded-turn:${entry.id}`;
    const galleryKey = `${owner}\u0000${turnId}`;
    const existing = galleries.get(galleryKey);
    // The server elides inline payloads into an explicit pointer; prefer it
    // over the owner-derived guess, which only holds for entries whose worker
    // could be resolved from the loaded window.
    const pointer = asRecord(content.omniWorkerContent);
    const tool = entry.toolCallId
      ? toolCalls.get(entry.toolCallId)
      : undefined;
    const image: GeneratedImageItem = {
      id: entry.id,
      mimeType: typeof content.mimeType === "string" ? content.mimeType : "image/png",
      data: typeof content.data === "string" ? content.data : undefined,
      generated: isGeneratedByToolCall(tool),
      name: fileName(tool?.path),
      reference: typeof pointer?.workerId === "string" && typeof pointer.entryId === "string"
        ? { workerId: pointer.workerId, entryId: pointer.entryId }
        : owner === "unowned"
          ? undefined
          : { workerId: owner, entryId: entry.id },
    };

    if (existing) {
      if (!existing.images.some((candidate) => candidate.id === image.id)) {
        existing.images.push(image);
      }
      // Place the gallery at the final generated image in the turn. In the
      // summarized conversation surface it is then lifted just after the work
      // summary, so it stays visible while tool details remain collapsed.
      existing.timestamp = entry.timestamp;
      existing.streamSeq = entry.seq;
      continue;
    }

    galleries.set(galleryKey, {
      id: `generated-images:${owner}:${turnId}`,
      kind: "generated_images",
      timestamp: entry.timestamp,
      streamSeq: entry.seq,
      images: [image],
    });
  }

  return [...galleries.values()];
}

export function isGeneratedImageEntry(entry: WorkerEntry) {
  if (entry.type !== "agent_content") {
    return false;
  }
  const raw = asRecord(entry.raw);
  return asRecord(raw?.content)?.type === "image";
}
