import type { WorkerEntry } from "@/shared/worker-entries";
import type { WorkerEntryContentReference } from "@/interface/home/WorkerEntryContentUrlManager";

export type GeneratedImageItem = {
  id: string;
  mimeType: string;
  data?: string;
  reference?: WorkerEntryContentReference;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function entryWorkerId(entry: WorkerEntry, fallbackWorkerId: string | undefined) {
  const candidate = (entry as WorkerEntry & { workerId?: unknown }).workerId;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : fallbackWorkerId;
}

/**
 * Project generated-image protocol entries into one stable gallery per user
 * turn. The worker stream remains the persistence authority; this is only a
 * display projection over the loaded window.
 */
export function buildGeneratedImagesActivity(
  entries: readonly WorkerEntry[],
  fallbackWorkerId?: string,
): GeneratedImagesActivity[] {
  const turnByWorker = new Map<string, string>();
  const galleries = new Map<string, GeneratedImagesActivity>();

  for (const entry of entries) {
    const owner = entryWorkerId(entry, fallbackWorkerId) ?? "unowned";
    if (TURN_BOUNDARY_TYPES.has(entry.type)) {
      turnByWorker.set(owner, entry.id);
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
    const image: GeneratedImageItem = {
      id: entry.id,
      mimeType: typeof content.mimeType === "string" ? content.mimeType : "image/png",
      data: typeof content.data === "string" ? content.data : undefined,
      reference: owner === "unowned"
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
