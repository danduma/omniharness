import fs from "fs";
import { createHash, randomUUID } from "node:crypto";
import path from "path";
import { imageMimeTypeForPath } from "@/lib/file-media";
import type { ProjectDirectoryResponse, ProjectFileContentResponse } from "@/shared/home-types";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".turbo",
  ".cache",
  "node_modules",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  "target",
  "out",
]);

export const PROJECT_TEXT_FILE_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_IMAGE_FILE_MAX_BYTES = 24 * 1024 * 1024;

export type ProjectImageFile = {
  root: string;
  path: string;
  bytes: Buffer;
  mimeType: string;
  size: number;
};

export type ReadProjectTextFileOptions = {
  maxBytes?: number;
};

export type ReadProjectImageFileOptions = {
  maxBytes?: number;
};

/** The file is not one of the types the viewer is allowed to hand back raw. */
export class UnsupportedProjectFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedProjectFileTypeError";
  }
}

/** The file is a supported type but too big to send to the viewer in one piece. */
export class ProjectFileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileTooLargeError";
  }
}

export function isPathInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function walkFiles(root: string, currentDir: string, files: string[]) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walkFiles(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(path.relative(root, absolutePath));
  }
}

export function listProjectFiles(root: string) {
  const resolvedRoot = path.resolve(root);
  const files: string[] = [];
  walkFiles(resolvedRoot, resolvedRoot, files);
  return files.sort((left, right) => left.localeCompare(right));
}

function looksBinary(buffer: Buffer) {
  if (buffer.includes(0)) {
    return true;
  }

  const text = buffer.toString("utf8");
  if (!text.includes("\uFFFD")) {
    return false;
  }

  const replacementCount = Array.from(text).filter((char) => char === "\uFFFD").length;
  return replacementCount > Math.max(2, text.length * 0.01);
}

export class ProjectFileAccessError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function resolveProjectFilePath(root: string, relativePath: string) {
  if (relativePath.includes("\0")) {
    throw new ProjectFileAccessError(400, "filesystem.invalid_file_request", "The file path is invalid.");
  }
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, relativePath);
  if (!isPathInside(resolvedRoot, absolutePath)) {
    throw new ProjectFileAccessError(403, "filesystem.outside_project", "File path is outside the project root.");
  }

  const realRoot = fs.realpathSync(resolvedRoot);
  const canonicalPath = fs.realpathSync(absolutePath);
  if (!isPathInside(realRoot, canonicalPath)) {
    throw new ProjectFileAccessError(403, "filesystem.outside_project", "File path is outside the project root.");
  }
  return { resolvedRoot, canonicalPath, relativePath: toProjectPath(path.relative(resolvedRoot, absolutePath)) };
}

function toProjectPath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

export function listProjectDirectory(root: string, directory: string): ProjectDirectoryResponse {
  const target = resolveProjectFilePath(root, directory);
  const entries: ProjectDirectoryResponse["entries"] = fs.readdirSync(target.canonicalPath, { withFileTypes: true })
    .map((entry) => {
      const entryPath = [target.relativePath, entry.name].filter(Boolean).join("/");
      let type = entry as Pick<fs.Dirent, "isDirectory" | "isFile">;
      if (entry.isSymbolicLink()) {
        try {
          type = fs.statSync(resolveProjectFilePath(root, entryPath).canonicalPath);
        } catch (error) {
          // A broken, inaccessible, or out-of-project target remains visible in
          // the listing without making other siblings inaccessible.
          if (!(error instanceof ProjectFileAccessError) && !(error instanceof Error && "code" in error)) throw error;
        }
      }
      return {
        name: entry.name,
        path: entryPath,
        kind: type.isDirectory() ? "directory" : type.isFile() ? "file" : "unavailable",
      };
    });
  entries.sort((left, right) => (
    Number(right.kind === "directory") - Number(left.kind === "directory") || left.name.localeCompare(right.name)
  ));
  return { root: target.resolvedRoot, directory: target.relativePath, entries };
}

function textRevision(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function readProjectTextFile(
  root: string,
  relativePath: string,
  options: ReadProjectTextFileOptions = {},
): ProjectFileContentResponse {
  const target = resolveProjectFilePath(root, relativePath);
  const initialStat = fs.statSync(target.canonicalPath);
  if (!initialStat.isFile()) {
    throw new ProjectFileAccessError(400, "filesystem.not_file", "Project path is not a file.");
  }

  const maxBytes = Math.max(1, options.maxBytes ?? PROJECT_TEXT_FILE_MAX_BYTES);
  const file = fs.openSync(target.canonicalPath, "r");
  try {
    const stat = fs.fstatSync(file);
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes + 1));
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const length = fs.readSync(file, buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (length === 0) break;
      bytesRead += length;
    }
    const size = fs.fstatSync(file).size;
    const truncated = bytesRead > maxBytes || size > bytesRead;
    const contentBuffer = buffer.subarray(0, Math.min(bytesRead, maxBytes));
    const binary = contentBuffer.includes(0) || (truncated
      ? looksBinary(contentBuffer)
      : !Buffer.from(contentBuffer.toString("utf8"), "utf8").equals(contentBuffer));
    if (binary) {
      throw new ProjectFileAccessError(415, "filesystem.binary_file", "Project file appears to be binary or is not valid UTF-8.");
    }
    return {
      root: target.resolvedRoot,
      path: target.relativePath,
      content: contentBuffer.toString("utf8"),
      size,
      truncated,
      revision: truncated ? null : textRevision(contentBuffer),
    };
  } finally {
    fs.closeSync(file);
  }
}

export function saveProjectTextFile(root: string, relativePath: string, revision: string, content: string) {
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length > PROJECT_TEXT_FILE_MAX_BYTES) {
    throw new ProjectFileAccessError(413, "filesystem.file_too_large", "Text exceeds the editor size limit.");
  }
  if (bytes.includes(0) || bytes.toString("utf8") !== content) {
    throw new ProjectFileAccessError(415, "filesystem.binary_file", "Project file cannot be saved as UTF-8 text.");
  }

  const target = resolveProjectFilePath(root, relativePath);
  const checkRevision = () => {
    const current = readProjectTextFile(root, relativePath);
    if (current.revision !== revision || resolveProjectFilePath(root, relativePath).canonicalPath !== target.canonicalPath) {
      throw new ProjectFileAccessError(409, "filesystem.file_changed", "The file changed on disk.");
    }
  };
  checkRevision();
  const mode = fs.statSync(target.canonicalPath).mode & 0o777;
  fs.accessSync(target.canonicalPath, fs.constants.W_OK);
  const temporaryPath = path.join(path.dirname(target.canonicalPath), `.omni-save-${randomUUID()}`);
  const file = fs.openSync(temporaryPath, "wx", mode);
  let replaced = false;
  try {
    try {
      fs.writeFileSync(file, bytes);
      fs.fchmodSync(file, mode);
      fs.fsyncSync(file);
    } finally {
      fs.closeSync(file);
    }
    checkRevision();
    fs.renameSync(temporaryPath, target.canonicalPath);
    replaced = true;
  } finally {
    // This exclusively created staging file belongs to this save operation.
    if (!replaced) fs.unlinkSync(temporaryPath);
  }

  return {
    root: target.resolvedRoot,
    path: target.relativePath,
    content,
    size: bytes.length,
    truncated: false,
    revision: textRevision(bytes),
  } satisfies ProjectFileContentResponse;
}

/**
 * Raw bytes for a project image, for the viewer to draw in an `<img>`.
 *
 * The type is decided by extension rather than by sniffing the content: the
 * caller sends this back as the response `Content-Type`, so it has to be a
 * value from the allowlist and never something derived from the file itself.
 */
export function readProjectImageFile(
  root: string,
  relativePath: string,
  options: ReadProjectImageFileOptions = {},
): ProjectImageFile {
  const { resolvedRoot, canonicalPath, relativePath: filePath } = resolveProjectFilePath(root, relativePath);
  const mimeType = imageMimeTypeForPath(filePath);
  if (!mimeType) {
    throw new UnsupportedProjectFileTypeError("Project file is not an image the viewer can display.");
  }

  const stat = fs.statSync(canonicalPath);
  if (!stat.isFile()) {
    throw new Error("Project path is not a file.");
  }

  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_IMAGE_FILE_MAX_BYTES);
  if (stat.size > maxBytes) {
    throw new ProjectFileTooLargeError(
      `Image is ${Math.round(stat.size / (1024 * 1024))} MB, over the ${Math.round(maxBytes / (1024 * 1024))} MB preview limit.`,
    );
  }

  return {
    root: resolvedRoot,
    path: filePath,
    bytes: fs.readFileSync(canonicalPath),
    mimeType,
    size: stat.size,
  };
}
