import path from "node:path";
import { constants, promises as fs } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import { readFromRuntimeOutputArchive, readWorkerOutputEntries } from "@/server/workers/output-store";
import { inlineImageContentData } from "@/shared/worker-entries";

const MAX_WORKER_CONTENT_BYTES = 25 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class WorkerEntryContentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorkerEntryContentError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findLatestEntryById<T extends { id?: string }>(entries: T[], entryId: string): T | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.id === entryId) {
      return entries[index] ?? null;
    }
  }
  return null;
}

function decodeCompleteBase64(data: string): Buffer | null {
  if (/\[(?:truncated|\d+ characters omitted)/i.test(data)) {
    return null;
  }
  const normalized = data.replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return null;
  }
  const body = Buffer.from(normalized, "base64");
  return body.length > 0 ? body : null;
}

function decodeInlineImage(entryType: string | undefined, raw: unknown): Buffer | null {
  const data = inlineImageContentData(entryType, raw);
  return data === null ? null : decodeCompleteBase64(data);
}

/**
 * The same entry as recorded in the agent runtime's output archive.
 *
 * The archive is a separate, looser-bounded copy of every bridge record. It is
 * rotated and pruned, so it is a best-effort fallback only — never the
 * authority. Returns null when the archive is gone or never held the payload.
 */
async function decodeArchivedImage(workerId: string, entryId: string): Promise<Buffer | null> {
  const archived = findLatestEntryById(await readFromRuntimeOutputArchive(workerId), entryId);
  return archived ? decodeInlineImage(archived.type, archived.raw) : null;
}

async function readCodexGeneratedImage(cwd: string, uri: string): Promise<Buffer> {
  const generatedImagesRoot = path.join(
    cwd,
    ".omniharness",
    "cli-home",
    "codex",
    "home",
    "generated_images",
  );
  const [canonicalRoot, canonicalTarget] = await Promise.all([
    fs.realpath(generatedImagesRoot),
    fs.realpath(uri),
  ]);
  const relative = path.relative(canonicalRoot, canonicalTarget);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkerEntryContentError("Generated image path is outside the worker content root.", 403);
  }
  const handle = await fs.open(canonicalTarget, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new WorkerEntryContentError("Generated image is not a regular file.", 404);
    }
    if (info.size > MAX_WORKER_CONTENT_BYTES) {
      throw new WorkerEntryContentError("Generated image exceeds the supported size limit.", 413);
    }

    // Re-resolve after opening, then prove the checked pathname still names
    // the exact inode held by the descriptor. This closes the check/read race:
    // later path replacement cannot redirect reads from the already-open fd.
    const canonicalAfterOpen = await fs.realpath(canonicalTarget);
    const relativeAfterOpen = path.relative(canonicalRoot, canonicalAfterOpen);
    if (
      !relativeAfterOpen
      || relativeAfterOpen === ".."
      || relativeAfterOpen.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeAfterOpen)
    ) {
      throw new WorkerEntryContentError("Generated image path changed outside the worker content root.", 403);
    }
    const pathInfo = await fs.stat(canonicalAfterOpen);
    if (pathInfo.dev !== info.dev || pathInfo.ino !== info.ino) {
      throw new WorkerEntryContentError("Generated image changed while it was being opened.", 409);
    }
    return handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readWorkerEntryContent(workerId: string, entryId: string) {
  const worker = await db.select({
    id: workers.id,
    runId: workers.runId,
    type: workers.type,
    cwd: workers.cwd,
  }).from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    throw new WorkerEntryContentError("Worker not found.", 404);
  }

  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
  const entry = findLatestEntryById(entries, entryId);
  const content = asRecord(asRecord(entry?.raw)?.content);
  if (!entry || content?.type !== "image") {
    throw new WorkerEntryContentError("Generated image entry not found.", 404);
  }

  const mimeType = typeof content.mimeType === "string" ? content.mimeType.toLowerCase() : "image/png";
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new WorkerEntryContentError("Generated image type is not supported.", 415);
  }

  const inlineBody = decodeInlineImage(entry.type, entry.raw)
    // Streams written before image payloads were exempted from raw-string
    // compaction hold only a truncated prefix of the base64. The runtime
    // archive bounds the same record far more loosely, so it can still answer
    // for those older transcripts.
    ?? await decodeArchivedImage(workerId, entryId);
  if (inlineBody) {
    if (inlineBody.length > MAX_WORKER_CONTENT_BYTES) {
      throw new WorkerEntryContentError("Generated image exceeds the supported size limit.", 413);
    }
    return { body: inlineBody, mimeType };
  }

  if (worker.type !== "codex" || typeof content.uri !== "string" || !path.isAbsolute(content.uri)) {
    throw new WorkerEntryContentError("Generated image data is unavailable.", 404);
  }

  try {
    return {
      body: await readCodexGeneratedImage(worker.cwd, content.uri),
      mimeType,
    };
  } catch (error) {
    if (error instanceof WorkerEntryContentError) {
      throw error;
    }
    const code = (error as NodeJS.ErrnoException).code;
    throw new WorkerEntryContentError(
      code === "ENOENT" ? "Generated image file no longer exists." : `Generated image could not be read: ${error instanceof Error ? error.message : String(error)}`,
      code === "ENOENT" ? 404 : 500,
    );
  }
}
