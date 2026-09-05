import fs from "fs";
import path from "path";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  describeAllowedRoots,
  findAllowedRootFor,
  getDefaultAllowedRoot,
} from "@/server/fs/allowed-roots";
import { isPathInside, listProjectFiles, readProjectTextFile } from "@/server/fs/files";
import type { OmniHttpHandler } from "@/runtime/http/registry";

class InvalidDirectoryCreationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDirectoryCreationRequestError";
  }
}

function getDirectoryCreationErrorStatus(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : null;
  if (code === "EEXIST") return 409;
  if (code === "ENOENT") return 404;
  if (code === "EACCES" || code === "EPERM") return 403;
  if (error instanceof InvalidDirectoryCreationRequestError || error instanceof SyntaxError) return 400;
  return 500;
}

function resolveInsideAllowedRoot(rawPath: string | null) {
  if (!rawPath) {
    return getDefaultAllowedRoot();
  }
  const resolvedPath = path.resolve(rawPath);
  return findAllowedRootFor(resolvedPath) ? resolvedPath : getDefaultAllowedRoot();
}

function resolveDirectoryCreation(parentPath: unknown, name: unknown) {
  if (typeof parentPath !== "string" || !parentPath.trim()) {
    throw new InvalidDirectoryCreationRequestError("Parent folder is required.");
  }
  if (typeof name !== "string") {
    throw new InvalidDirectoryCreationRequestError("Folder name is required.");
  }

  const normalizedName = name.trim();
  if (
    !normalizedName
    || normalizedName === "."
    || normalizedName === ".."
    || normalizedName.includes("/")
    || normalizedName.includes("\\")
    || normalizedName.includes("\0")
    || path.isAbsolute(normalizedName)
  ) {
    throw new InvalidDirectoryCreationRequestError("Folder name must be a single folder name without path separators.");
  }

  const resolvedParentPath = path.resolve(parentPath);
  const rootPath = findAllowedRootFor(resolvedParentPath);
  if (!rootPath) {
    throw new InvalidDirectoryCreationRequestError("Parent folder is outside the allowed filesystem root.");
  }

  const realRootPath = fs.realpathSync(rootPath);
  const realParentPath = fs.realpathSync(resolvedParentPath);
  if (!isPathInside(realRootPath, realParentPath) || !fs.statSync(realParentPath).isDirectory()) {
    throw new InvalidDirectoryCreationRequestError("Parent folder is outside the allowed filesystem root.");
  }

  // Use the canonical parent so a pre-existing symlink cannot redirect the
  // mutation outside the browse root. Node has no portable mkdirat/openat2;
  // a same-account actor swapping canonical ancestors between these syscalls
  // already has equivalent direct filesystem authority outside this API.
  return {
    parentPath: realParentPath,
    targetPath: path.join(realParentPath, normalizedName),
  };
}

export const handleBrowseFilesystemRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Filesystem",
      action: "Browse directories",
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const dirPath = resolveInsideAllowedRoot(url.searchParams.get("path"));
    const rootPath = findAllowedRootFor(dirPath);

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({ name: entry.name, path: path.join(dirPath, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(dirPath);
    const parent = rootPath && isPathInside(rootPath, parentPath) ? parentPath : dirPath;

    return Response.json({
      current: dirPath,
      parent,
      root: rootPath,
      roots: describeAllowedRoots(),
      directories,
    });
  } catch (error) {
    return errorResponse(error, {
      status: 400,
      source: "Filesystem",
      action: "Browse directories",
    });
  }
};

export const handleCreateDirectoryRequest: OmniHttpHandler = async (request) => {
  let parentPath: string | null = null;
  let targetPath: string | null = null;
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Filesystem",
      action: "Create folder",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json() as { parentPath?: unknown; name?: unknown };
    const resolved = resolveDirectoryCreation(body.parentPath, body.name);
    parentPath = resolved.parentPath;
    targetPath = resolved.targetPath;
    fs.mkdirSync(targetPath);
    emitNamedEvent({
      kind: "filesystem.directory_created",
      parentPath,
      path: targetPath,
    });

    return Response.json({ path: targetPath }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitNamedEvent({
      kind: "filesystem.directory_create_failed",
      parentPath,
      path: targetPath,
      reason: message,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "filesystem.directory_create_failed",
      message,
      surface: "toast",
      path: targetPath ?? parentPath ?? undefined,
      cause: error instanceof Error ? { name: error.name, message: error.message } : null,
    });
    return errorResponse(error, {
      status: getDirectoryCreationErrorStatus(error),
      source: "Filesystem",
      action: "Create folder",
    });
  }
};

export const handleProjectFilesRequest: OmniHttpHandler = async (request) => {
  let action = "Load project files";
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Filesystem",
      action: "Load project files",
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const projectPath = resolveInsideAllowedRoot(url.searchParams.get("root"));
    const filePath = url.searchParams.get("file");
    if (filePath) {
      action = "Read project file";
      return Response.json(readProjectTextFile(projectPath, filePath));
    }

    return Response.json({
      root: projectPath,
      files: listProjectFiles(projectPath),
    });
  } catch (error) {
    return errorResponse(error, {
      status: 400,
      source: "Filesystem",
      action,
    });
  }
};
