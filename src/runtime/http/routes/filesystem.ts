import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { videoMimeTypeForPath } from "@/lib/file-media";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  describeAllowedRoots,
  findAllowedRootFor,
  getDefaultAllowedRoot,
} from "@/server/fs/allowed-roots";
import {
  isPathInside,
  listProjectDirectory,
  listProjectFiles,
  ProjectFileAccessError,
  ProjectFileTooLargeError,
  PROJECT_TEXT_FILE_MAX_BYTES,
  readProjectImageFile,
  readProjectTextFile,
  resolveProjectFilePath,
  saveProjectTextFile,
  UnsupportedProjectFileTypeError,
} from "@/server/fs/files";
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

function resolveAllowedProjectRoot(rawRoot: string | null) {
  const projectPath = path.resolve(rawRoot || getDefaultAllowedRoot());
  const allowedRoot = findAllowedRootFor(projectPath);
  if (!allowedRoot || !isPathInside(fs.realpathSync(allowedRoot), fs.realpathSync(projectPath))) {
    throw new ProjectFileAccessError(403, "filesystem.outside_project", "Project is outside the allowed filesystem root.");
  }
  return projectPath;
}

function projectFileError(error: unknown) {
  if (error instanceof ProjectFileAccessError) return error;
  const code = error instanceof Error && "code" in error ? error.code : null;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return new ProjectFileAccessError(404, "filesystem.file_missing", "The file or folder no longer exists.");
  }
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    return new ProjectFileAccessError(403, "filesystem.permission_denied", "The filesystem denied access.");
  }
  if (error instanceof SyntaxError) {
    return new ProjectFileAccessError(400, "filesystem.invalid_file_request", "The file request is invalid.");
  }
  return new ProjectFileAccessError(500, "filesystem.file_operation_failed", "The filesystem operation failed.");
}

function projectFileErrorResponse(error: ProjectFileAccessError) {
  return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export const handleSaveProjectFileRequest: OmniHttpHandler = async (request) => {
  const url = new URL(request.url);
  const root = url.searchParams.get("root");
  const file = url.searchParams.get("file");
  const auth = await requireApiSession(request, {
    source: "Filesystem",
    action: "Save project file",
    enforceSameOrigin: true,
  });
  if (auth.response) return auth.response;

  try {
    if (!root || !file) {
      throw new ProjectFileAccessError(400, "filesystem.invalid_file_request", "A project root and file path are required.");
    }
    // JSON can escape a single UTF-8 byte as six characters (e.g. a tab).
    const bodyText = await request.text();
    if (bodyText.length > PROJECT_TEXT_FILE_MAX_BYTES * 6 + 1024) {
      throw new ProjectFileAccessError(413, "filesystem.file_too_large", "Text exceeds the editor size limit.");
    }
    const body: unknown = JSON.parse(bodyText);
    if (!body || typeof body !== "object" || !("content" in body) || typeof body.content !== "string"
      || !("revision" in body) || typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision)) {
      throw new ProjectFileAccessError(400, "filesystem.invalid_file_request", "File content and an existing revision are required.");
    }
    const result = saveProjectTextFile(resolveAllowedProjectRoot(root), file, body.revision, body.content);
    emitNamedEvent({ kind: "filesystem.file_saved", root: result.root, path: result.path, revision: result.revision });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const failure = projectFileError(error);
    emitNamedEvent({ kind: "filesystem.file_save_failed", root, path: file, reason: failure.code });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "filesystem.file_save_failed",
      message: failure.message,
      surface: "log",
      path: file ?? root ?? undefined,
    });
    return projectFileErrorResponse(failure);
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
    const projectPath = resolveAllowedProjectRoot(url.searchParams.get("root"));
    const filePath = url.searchParams.get("file");
    const directory = url.searchParams.get("directory");
    if (directory !== null) {
      return Response.json(listProjectDirectory(projectPath, directory), { headers: { "cache-control": "no-store" } });
    }
    if (filePath) {
      action = "Read project file";
      if (url.searchParams.get("video") === "1") {
        return serveProjectVideo(request, projectPath, filePath);
      }
      if (url.searchParams.get("browser") === "1") {
        if (!/\.html?$/i.test(filePath)) throw new Error("Browser preview requires an HTML file.");
        const { canonicalPath } = resolveProjectFilePath(projectPath, filePath);
        const stat = fs.statSync(canonicalPath);
        if (!stat.isFile()) throw new Error("Project path is not a file.");
        if (stat.size > 24 * 1024 * 1024) throw new Error("HTML file exceeds the 24 MB browser preview limit.");
        return new Response(new Uint8Array(fs.readFileSync(canonicalPath)), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": "sandbox allow-scripts allow-forms allow-popups",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
          },
        });
      }
      if (url.searchParams.get("download") === "1") {
        return downloadProjectFile(request, projectPath, filePath);
      }
      return Response.json(readProjectTextFile(projectPath, filePath), { headers: { "cache-control": "no-store" } });
    }

    return Response.json({
      root: projectPath,
      files: listProjectFiles(projectPath),
    });
  } catch (error) {
    const url = new URL(request.url);
    if (url.searchParams.get("video") === "1") {
      reportVideoFailure(url.searchParams.get("file"), error);
    }
    if (!url.searchParams.has("video") && !url.searchParams.has("browser")
      && (url.searchParams.has("file") || url.searchParams.has("directory"))) {
      return projectFileErrorResponse(projectFileError(error));
    }
    return errorResponse(error, {
      status: 400,
      source: "Filesystem",
      action,
    });
  }
};

function getProjectImageErrorStatus(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : null;
  if (code === "ENOENT") return 404;
  if (code === "EACCES" || code === "EPERM") return 403;
  if (error instanceof ProjectFileAccessError) return error.status;
  if (error instanceof UnsupportedProjectFileTypeError) return 415;
  if (error instanceof ProjectFileTooLargeError) return 413;
  return 400;
}

export const handleProjectImageRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Filesystem",
      action: "Read project image",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const projectPath = resolveAllowedProjectRoot(url.searchParams.get("root"));
    const filePath = url.searchParams.get("file");
    if (!filePath) {
      return errorResponse("File path is required.", {
        status: 400,
        source: "Filesystem",
        action: "Read project image",
      });
    }

    const image = readProjectImageFile(projectPath, filePath);
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.bytes.byteLength),
        "Cache-Control": "private, no-store",
        // An SVG reaching the browser as a top-level document would run its own
        // scripts in this origin. The viewer only ever draws these bytes inside
        // an <img>, where that cannot happen, so pin the rest shut: no
        // subresources, no sniffing a different type out of the content.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return errorResponse(error, {
      status: getProjectImageErrorStatus(error),
      source: "Filesystem",
      action: "Read project image",
    });
  }
};

function downloadProjectFile(request: Request, root: string, file: string) {
  const target = resolveProjectFilePath(root, file);
  const stat = fs.statSync(target.canonicalPath);
  if (!stat.isFile()) {
    throw new ProjectFileAccessError(400, "filesystem.not_file", "Project path is not a file.");
  }
  const stream = fs.createReadStream(target.canonicalPath, { signal: request.signal });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(stat.size),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(target.relativePath))}`,
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Stream media and byte ranges without loading the whole video into memory. */
function serveProjectVideo(request: Request, projectPath: string, filePath: string) {
  const mimeType = videoMimeTypeForPath(filePath);
  if (!mimeType) throw new Error("Project file is not a supported video type.");
  const { canonicalPath } = resolveProjectFilePath(projectPath, filePath);
  const stat = fs.statSync(canonicalPath);
  if (!stat.isFile()) throw new Error("Project path is not a file.");
  const headers = new Headers({
    "content-type": mimeType,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; media-src 'self' blob:; sandbox",
    "content-disposition": new URL(request.url).searchParams.get("download") === "1"
      ? `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(canonicalPath))}`
      : "inline",
  });
  let start = 0;
  let end = stat.size - 1;
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    } else {
      start = -1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
      reportVideoFailure(filePath, new Error("Requested video byte range is not satisfiable."));
      headers.set("content-range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("content-range", `bytes ${start}-${end}/${stat.size}`);
  }
  headers.set("content-length", String(Math.max(0, end - start + 1)));
  if (!stat.size) return new Response(null, { headers });
  const stream = fs.createReadStream(canonicalPath, { start, end, signal: request.signal });
  stream.on("error", (error) => {
    if (!request.signal.aborted) reportVideoFailure(filePath, error);
  });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}

function reportVideoFailure(filePath: string | null, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  emitNamedEvent({ kind: "filesystem.video_read_failed", path: filePath, reason: message });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "filesystem.video_read_failed",
    message,
    surface: "banner",
    path: filePath ?? undefined,
  });
}
