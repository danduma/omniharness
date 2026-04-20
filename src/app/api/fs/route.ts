import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
