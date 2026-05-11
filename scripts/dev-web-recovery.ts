import path from "path";

export type NextDevRouteEnoentRecovery = {
  artifactDir: string;
  routeFile: string;
};

const ROUTE_ARTIFACT_PATTERN = /ENOENT: no such file or directory, open ['"]([^'"]+[/\\]\.next[/\\]server[/\\]app[/\\][^'"]+[/\\]route\.js)['"]/;

function isInsidePath(childPath: string, parentPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function detectNextDevRouteEnoent(line: string, repoRoot: string): NextDevRouteEnoentRecovery | null {
  if (!line.includes("ENOENT") || !line.includes("route.js")) {
    return null;
  }

  const match = ROUTE_ARTIFACT_PATTERN.exec(line);
  if (!match) {
    return null;
  }

  const routeFile = path.resolve(match[1]);
  const appServerDir = path.join(path.resolve(repoRoot), ".next", "server", "app");
  if (!isInsidePath(routeFile, appServerDir)) {
    return null;
  }

  return {
    artifactDir: path.dirname(routeFile),
    routeFile,
  };
}
