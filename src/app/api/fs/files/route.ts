import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { listProjectFiles } from "@/server/fs/files";

export async function GET(req: NextRequest) {
  try {
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

