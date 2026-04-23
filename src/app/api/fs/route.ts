import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Filesystem",
      action: "Browse directories",
    });
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(req.url);
    const rootPath = path.resolve(process.cwd(), '..');
    
    let dirPath = url.searchParams.get("path") || rootPath;
    dirPath = path.resolve(dirPath);
    
    // Prevent directory traversal above root
    if (!dirPath.startsWith(rootPath)) {
      dirPath = rootPath;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const directories = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(dirPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
      
    const parentPath = path.dirname(dirPath);
    // Don't allow parent navigation above the rootPath
    const parent = parentPath.startsWith(rootPath) ? parentPath : dirPath;

    return NextResponse.json({ 
      current: dirPath, 
      parent: parent, 
      directories 
    });
  } catch (err: unknown) {
    return errorResponse(err, {
      status: 400,
      source: "Filesystem",
      action: "Browse directories",
    });
  }
}
