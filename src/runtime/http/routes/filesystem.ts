import fs from "fs";
import path from "path";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { isPathInside, listProjectFiles, readProjectTextFile } from "@/server/fs/files";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

function getAllowedRoot() {
  return path.resolve(process.cwd(), "..");
}

function resolveInsideAllowedRoot(rawPath: string | null) {
  const rootPath = getAllowedRoot();
  const resolvedPath = path.resolve(rawPath || rootPath);
  return isPathInside(rootPath, resolvedPath) ? resolvedPath : rootPath;
}

export const handleBrowseFilesystemRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Filesystem",
      action: "Browse directories",
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const rootPath = getAllowedRoot();
    const dirPath = resolveInsideAllowedRoot(url.searchParams.get("path"));

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({ name: entry.name, path: path.join(dirPath, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(dirPath);
    const parent = isPathInside(rootPath, parentPath) ? parentPath : dirPath;

    return Response.json({
      current: dirPath,
      parent,
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

export const handleProjectFilesRequest: OmniHttpHandler = async (request) => {
  let action = "Load project files";
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
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
