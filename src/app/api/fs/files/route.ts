import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { listProjectFiles } from "@/server/fs/files";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Filesystem",
      action: "Load project files",
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(req.url);
    const rootPath = path.resolve(process.cwd(), "..");
    let projectPath = url.searchParams.get("root") || rootPath;
    projectPath = path.resolve(projectPath);

    if (!projectPath.startsWith(rootPath)) {
      projectPath = rootPath;
    }

    return NextResponse.json({
      root: projectPath,
      files: listProjectFiles(projectPath),
    });
  } catch (err: unknown) {
    return errorResponse(err, {
      status: 400,
      source: "Filesystem",
      action: "Load project files",
    });
  }
}
