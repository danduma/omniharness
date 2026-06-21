import fs from "fs";
import path from "path";
import { SupervisorProtocolError } from "@/server/supervisor/protocol";
import { ensureProjectOmniharnessDir, getProjectOmniharnessDir } from "@/server/projects/config";

const MEMORY_DIRNAME = "memory";
const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".json"]);

export function getMemoryRoot(projectPath: string) {
  return path.join(getProjectOmniharnessDir(projectPath), MEMORY_DIRNAME);
}

export function ensureMemoryRoot(projectPath: string) {
  ensureProjectOmniharnessDir(projectPath);
  const root = getMemoryRoot(projectPath);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

function isPathInside(childPath: string, parentPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveMemoryPath(projectPath: string | null | undefined, requestedPath: string): {
  absolutePath: string;
  relativePath: string;
  root: string;
} {
  if (!projectPath) {
    throw new SupervisorProtocolError("Project memory requires a run project path.");
  }

  if (typeof requestedPath !== "string" || requestedPath.length === 0) {
    throw new SupervisorProtocolError("Memory path must be a non-empty string.");
  }

  if (requestedPath.includes("\0")) {
    throw new SupervisorProtocolError("Memory path cannot contain NUL bytes.");
  }

  if (path.isAbsolute(requestedPath)) {
    throw new SupervisorProtocolError("Memory path must be relative to the memory root.");
  }

  const normalizedRel = path.normalize(requestedPath);
  if (normalizedRel === "." || normalizedRel === "..") {
    throw new SupervisorProtocolError("Memory path must point to a file inside the memory root.");
  }

  if (normalizedRel.split(path.sep).includes("..")) {
    throw new SupervisorProtocolError(`Memory path "${requestedPath}" escapes the memory root.`);
  }

  const ext = path.extname(normalizedRel).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new SupervisorProtocolError(
      `Memory path "${requestedPath}" must end in one of: ${[...ALLOWED_EXTENSIONS].join(", ")}.`,
    );
  }

  const root = getMemoryRoot(projectPath);
  const absolutePath = path.resolve(root, normalizedRel);

  if (!isPathInside(absolutePath, root)) {
    throw new SupervisorProtocolError(`Memory path "${requestedPath}" escapes the memory root.`);
  }

  if (fs.existsSync(absolutePath)) {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      const real = fs.realpathSync(absolutePath);
      if (!isPathInside(real, fs.existsSync(root) ? fs.realpathSync(root) : root)) {
        throw new SupervisorProtocolError(`Memory path "${requestedPath}" is a symlink that escapes the memory root.`);
      }
    }
    if (stat.isDirectory()) {
      throw new SupervisorProtocolError(`Memory path "${requestedPath}" is a directory, not a file.`);
    }
  }

  return {
    absolutePath,
    relativePath: normalizedRel,
    root,
  };
}
