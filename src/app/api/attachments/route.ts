import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { getAppDataPath } from "@/server/app-root";
import {
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
  chatAttachmentKindFromMimeType,
  type ChatAttachment,
} from "@/lib/chat-attachments";

const ATTACHMENTS_ROOT = "attachments";

function sanitizeFilename(name: string) {
  const sanitized = name.normalize("NFKD")
    .replace(/[\\/\0]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "attachment";
}

function resolveAttachmentPath(storagePath: string) {
  const normalized = storagePath.replace(/\\/g, "/");
  if (!normalized.startsWith(`${ATTACHMENTS_ROOT}/`) || normalized.includes("..")) {
    return null;
  }

  const root = getAppDataPath(ATTACHMENTS_ROOT);
  const absolutePath = getAppDataPath(normalized);
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return absolutePath;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Attachments",
      action: "Read attachment",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const storagePath = req.nextUrl.searchParams.get("path")?.trim() || "";
    const absolutePath = resolveAttachmentPath(storagePath);
    if (!absolutePath) {
      return errorResponse("Attachment path is invalid", {
        status: 400,
        source: "Attachments",
        action: "Read attachment",
      });
    }

    const body = await readFile(absolutePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": req.nextUrl.searchParams.get("mimeType") || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Attachments",
      action: "Read attachment",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Attachments",
      action: "Upload attachments",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const formData = await req.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return errorResponse("At least one attachment is required", {
        status: 400,
        source: "Attachments",
        action: "Upload attachments",
      });
    }

    if (files.length > CHAT_ATTACHMENT_MAX_FILES) {
      return errorResponse(`Upload at most ${CHAT_ATTACHMENT_MAX_FILES} attachments at a time`, {
        status: 400,
        source: "Attachments",
        action: "Upload attachments",
      });
    }

    const oversized = files.find((file) => file.size > CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES);
    if (oversized) {
      return errorResponse(`${oversized.name || "Attachment"} exceeds the maximum upload size`, {
        status: 413,
        source: "Attachments",
        action: "Upload attachments",
      });
    }

    const uploadId = randomUUID();
    const uploadDir = getAppDataPath(ATTACHMENTS_ROOT, uploadId);
    await mkdir(uploadDir, { recursive: true });

    const attachments: ChatAttachment[] = [];
    for (const file of files) {
      const attachmentId = randomUUID();
      const safeName = sanitizeFilename(file.name || "attachment");
      const filename = `${attachmentId}-${safeName}`;
      const storagePath = path.join(ATTACHMENTS_ROOT, uploadId, filename);
      const mimeType = file.type || "application/octet-stream";
      await writeFile(getAppDataPath(storagePath), Buffer.from(await file.arrayBuffer()));
      attachments.push({
        id: attachmentId,
        kind: chatAttachmentKindFromMimeType(mimeType),
        name: safeName,
        mimeType,
        size: file.size,
        storagePath,
      });
    }

    return NextResponse.json({ ok: true, attachments });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Attachments",
      action: "Upload attachments",
    });
  }
}
