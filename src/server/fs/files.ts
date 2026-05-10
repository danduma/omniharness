import fs from "fs";
import path from "path";

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

export type ProjectFileContent = {
  root: string;
  path: string;
  content: string;
  size: number;
  truncated: boolean;
};

export type ReadProjectTextFileOptions = {
  maxBytes?: number;
};

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

export function readProjectTextFile(
  root: string,
  relativePath: string,
  options: ReadProjectTextFileOptions = {},
): ProjectFileContent {
  const resolvedRoot = path.resolve(root);
  const normalizedRelativePath = relativePath.replace(/\\/g, path.sep);
  const absolutePath = path.resolve(resolvedRoot, normalizedRelativePath);
  if (!isPathInside(resolvedRoot, absolutePath)) {
    throw new Error("File path is outside the project root.");
  }

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
