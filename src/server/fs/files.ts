import fs from "fs";
import path from "path";
import { imageMimeTypeForPath } from "@/lib/file-media";

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

const DEFAULT_TEXT_FILE_MAX_BYTES = 512 * 1024;
const DEFAULT_IMAGE_FILE_MAX_BYTES = 24 * 1024 * 1024;

export type ProjectFileContent = {
  root: string;
  path: string;
  content: string;
  size: number;
  truncated: boolean;
};

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
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function resolveProjectFilePath(root: string, relativePath: string) {
  const resolvedRoot = path.resolve(root);
  const normalizedRelativePath = relativePath.replace(/\\/g, path.sep);
  const absolutePath = path.resolve(resolvedRoot, normalizedRelativePath);
  if (!isPathInside(resolvedRoot, absolutePath)) {
    throw new Error("File path is outside the project root.");
  }

  return { resolvedRoot, absolutePath };
}

export function readProjectTextFile(
  root: string,
  relativePath: string,
  options: ReadProjectTextFileOptions = {},
): ProjectFileContent {
  const { resolvedRoot, absolutePath } = resolveProjectFilePath(root, relativePath);

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error("Project path is not a file.");
  }

  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_TEXT_FILE_MAX_BYTES);
  const file = fs.openSync(absolutePath, "r");
  try {
    const readLength = Math.min(stat.size, maxBytes + 1);
    const buffer = Buffer.alloc(readLength);
    const bytesRead = fs.readSync(file, buffer, 0, readLength, 0);
    const readBuffer = buffer.subarray(0, bytesRead);
    if (looksBinary(readBuffer)) {
      throw new Error("Project file appears to be binary and cannot be displayed.");
    }

    const truncated = stat.size > maxBytes;
    const contentBuffer = truncated ? readBuffer.subarray(0, maxBytes) : readBuffer;
    return {
      root: resolvedRoot,
      path: path.relative(resolvedRoot, absolutePath).replace(/\\/g, "/"),
      content: contentBuffer.toString("utf8"),
      size: stat.size,
      truncated,
    };
  } finally {
    fs.closeSync(file);
  }
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
  const { resolvedRoot, absolutePath } = resolveProjectFilePath(root, relativePath);
  const mimeType = imageMimeTypeForPath(absolutePath);
  if (!mimeType) {
    throw new UnsupportedProjectFileTypeError("Project file is not an image the viewer can display.");
  }

  const stat = fs.statSync(absolutePath);
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
    path: path.relative(resolvedRoot, absolutePath).replace(/\\/g, "/"),
    bytes: fs.readFileSync(absolutePath),
    mimeType,
    size: stat.size,
  };
}
