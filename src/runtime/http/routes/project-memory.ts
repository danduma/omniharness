import path from "path";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { isProjectMemoryEnabled, setProjectSetting } from "@/server/projects/config";
import { SupervisorProtocolError } from "@/server/supervisor/protocol";
import { listMemory, readMemory, writeMemory } from "@/server/supervisor/memory-tools";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

const PROJECT_MEMORY_UI_FILE_LIMIT_BYTES = 200_000;

function resolveProjectPath(raw: string | null) {
  if (!raw || raw.trim().length === 0) {
    throw new SupervisorProtocolError("Project path is required.");
  }
  return path.resolve(raw.trim());
}

async function bumpMetadataRevisionForActiveProjectRuns(projectPath: string) {
  const allRuns = await db.select().from(runs).where(eq(runs.projectPath, projectPath));
  for (const run of allRuns) {
    if (run.status === "running" || run.status === "awaiting_user") {
      await db.update(runs).set({
        memoryMetadataRevision: (run.memoryMetadataRevision ?? 0) + 1,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
  }
}

async function getProjectMemory(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Project memory",
    action: "List project memory files",
  });
  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const projectPath = resolveProjectPath(url.searchParams.get("projectPath"));
  const requestedFile = url.searchParams.get("path");
  const enabled = isProjectMemoryEnabled(projectPath);

  if (requestedFile) {
    const file = readMemory(projectPath, requestedFile, { maxBytes: PROJECT_MEMORY_UI_FILE_LIMIT_BYTES });
    return Response.json({
      enabled,
      file: {
        path: file.path,
        content: file.content,
        truncated: file.truncated,
        size: file.size,
        updatedAt: file.updatedAt,
      },
    });
  }

  return Response.json({
    enabled,
    files: listMemory(projectPath),
  });
}

async function postProjectMemory(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Project memory",
    action: "Update project memory",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json() as Record<string, unknown>;
  const projectPath = resolveProjectPath(typeof body.projectPath === "string" ? body.projectPath : null);

  if (typeof body.enabled === "boolean") {
    setProjectSetting(projectPath, "supervisor.memoryEnabled", body.enabled);
    await bumpMetadataRevisionForActiveProjectRuns(projectPath);
    return Response.json({ ok: true, enabled: body.enabled });
  }

  if (typeof body.path !== "string" || typeof body.content !== "string") {
    throw new SupervisorProtocolError("Both \"path\" and \"content\" must be strings.");
  }

  const result = writeMemory(projectPath, body.path, body.content);
  await bumpMetadataRevisionForActiveProjectRuns(projectPath);
  return Response.json({
    ok: true,
    file: {
      path: result.path,
      operation: result.operation,
      newSize: result.newSize,
      updatedAt: result.updatedAt,
    },
  });
}

export const handleProjectMemoryRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") {
      return getProjectMemory(request);
    }
    if (request.method === "POST") {
      return postProjectMemory(request);
    }
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, POST" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 400,
      source: "Project memory",
      action: request.method === "POST" ? "Update project memory" : "List project memory files",
    });
  }
};
