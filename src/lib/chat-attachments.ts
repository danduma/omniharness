export type ChatAttachmentKind = "image" | "file";

export interface ChatAttachment {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  previewUrl?: string;
}

export interface PendingChatAttachment extends ChatAttachment {
  file: File;
  previewUrl?: string;
}

export const CHAT_ATTACHMENT_MAX_FILES = 10;
export const CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function chatAttachmentKindFromMimeType(mimeType: string): ChatAttachmentKind {
  return mimeType.startsWith("image/") ? "image" : "file";
}

export function normalizeChatAttachment(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawStoragePath = typeof value.storagePath === "string" && value.storagePath.trim()
    ? value.storagePath.trim()
    : typeof value.path === "string" && value.path.trim()
      ? value.path.trim()
      : undefined;
  const fallbackName = rawStoragePath?.split(/[/\\]/).filter(Boolean).pop();
  const name = typeof value.name === "string" && value.name.trim()
    ? value.name.trim()
    : fallbackName || null;
  const id = typeof value.id === "string" && value.id.trim()
    ? value.id.trim()
    : name && rawStoragePath
      ? `legacy-${name}-${rawStoragePath}`
      : null;
  const mimeType = typeof value.mimeType === "string" ? value.mimeType.trim() : "";
  const kind = value.kind === "image" || value.kind === "file"
    ? value.kind
    : chatAttachmentKindFromMimeType(mimeType);
  const size = typeof value.size === "number" && Number.isFinite(value.size) && value.size >= 0
    ? value.size
    : 0;
  const storagePath = rawStoragePath;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    kind,
    name,
    mimeType,
    size,
    ...(storagePath ? { storagePath } : {}),
  };
}

export function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeChatAttachment).filter((attachment): attachment is ChatAttachment => Boolean(attachment));
}

export function parseChatAttachmentsJson(value: string | null | undefined): ChatAttachment[] {
  if (!value) {
    return [];
  }

  try {
    return normalizeChatAttachments(JSON.parse(value));
  } catch {
    return [];
  }
}

export function serializeChatAttachments(attachments: ChatAttachment[]): string | null {
  const persisted = normalizeChatAttachments(attachments).map(({ id, kind, name, mimeType, size, storagePath }) => ({
    id,
    kind,
    name,
    mimeType,
    size,
    ...(storagePath ? { storagePath } : {}),
  }));

  return persisted.length > 0 ? JSON.stringify(persisted) : null;
}

export function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

export interface AttachmentContextOptions {
  // Map a stored attachment path to the path that should be embedded in
  // the prompt the worker sees. Storage paths are relative to the
  // OmniHarness data root, but the worker's cwd is the user's project,
  // so callers on the server must pass an absolute-path resolver
  // (typically `getAppDataPath`). Without it the worker tries to read a
  // file that doesn't exist under its cwd.
  resolvePath?: (storagePath: string) => string;
}

export function formatAttachmentContext(
  attachments: ChatAttachment[],
  options: AttachmentContextOptions = {},
) {
  const normalized = normalizeChatAttachments(attachments).filter((attachment) => attachment.storagePath);
  if (normalized.length === 0) {
    return "";
  }

  const resolvePath = options.resolvePath ?? ((p: string) => p);
  const lines = normalized.map((attachment) => [
    `- ${attachment.name}`,
    `kind: ${attachment.kind}`,
    `mime: ${attachment.mimeType || "unknown"}`,
    `size: ${formatBytes(attachment.size)}`,
    `path: ${resolvePath(attachment.storagePath!)}`,
  ].join(" | "));

  return `Attached files available to inspect:\n${lines.join("\n")}`;
}

export function appendAttachmentContext(
  content: string,
  attachments: ChatAttachment[],
  options: AttachmentContextOptions = {},
) {
  const context = formatAttachmentContext(attachments, options);
  const trimmedContent = content.trim();

  if (!context) {
    return trimmedContent;
  }

  const hasImages = normalizeChatAttachments(attachments).some((a) => a.kind === "image" && a.storagePath);
  const toolHint = hasImages
    ? "\n\nTo view attached images, use the `view_image` tool with the file path shown above."
    : "";

  const fullContext = context + toolHint;

  return trimmedContent ? `${trimmedContent}\n\n${fullContext}` : fullContext;
}
