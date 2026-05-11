export function normalizeProjectPath(projectPath: string) {
  return projectPath.trim().replace(/[/\\]+$/, "") || "/";
}

function pathSeparatorFor(projectPath: string) {
  return projectPath.includes("\\") && !projectPath.includes("/") ? "\\" : "/";
}

export function isSameOrDescendantPath(pathValue: string, rootValue: string) {
  const path = normalizeProjectPath(pathValue);
  const root = normalizeProjectPath(rootValue);
  if (path === root) {
    return true;
  }

  return path.startsWith(`${root}${pathSeparatorFor(root)}`);
}

export function normalizeExplicitProjectPaths(explicitProjects: string[]) {
  return Array.from(new Set(
    explicitProjects
      .map((projectPath) => normalizeProjectPath(projectPath))
      .filter((projectPath) => projectPath.length > 0),
  ));
}

export function resolveStaleProjectFallback(
  explicitProjects: string[],
  storedProjectPaths: Array<string | null | undefined>,
) {
  const normalizedExplicitProjects = normalizeExplicitProjectPaths(explicitProjects);
  if (normalizedExplicitProjects.length === 0) {
    return null;
  }

  const directRunCounts = new Map(normalizedExplicitProjects.map((projectPath) => [projectPath, 0]));
  let hasUnmatchedStoredPath = false;

  for (const storedProjectPath of storedProjectPaths) {
    const storedPath = storedProjectPath?.trim()
      ? normalizeProjectPath(storedProjectPath)
      : null;
    if (!storedPath) {
      continue;
    }

    const matchingExplicitProject = normalizedExplicitProjects.find((projectPath) => (
      isSameOrDescendantPath(storedPath, projectPath)
    ));

    if (matchingExplicitProject) {
      directRunCounts.set(matchingExplicitProject, (directRunCounts.get(matchingExplicitProject) ?? 0) + 1);
    } else {
      hasUnmatchedStoredPath = true;
    }
  }

  if (!hasUnmatchedStoredPath) {
    return null;
  }

  const emptyExplicitProjects = normalizedExplicitProjects.filter((projectPath) => (
    (directRunCounts.get(projectPath) ?? 0) === 0
  ));

  return emptyExplicitProjects.length === 1 ? emptyExplicitProjects[0] : null;
}

export function resolveStoredProjectRoot(
  storedProjectPath: string | null | undefined,
  explicitProjects: string[],
  options: { staleFallbackProject?: string | null } = {},
) {
  const normalizedExplicitProjects = normalizeExplicitProjectPaths(explicitProjects);
  const storedPath = storedProjectPath?.trim()
    ? normalizeProjectPath(storedProjectPath)
    : null;

  if (!storedPath) {
    return null;
  }

  const matchingExplicitProject = normalizedExplicitProjects.find((projectPath) => (
    isSameOrDescendantPath(storedPath, projectPath)
  ));
  if (matchingExplicitProject) {
    return matchingExplicitProject;
  }

  if (normalizedExplicitProjects.length === 0) {
    return storedPath;
  }

  if (normalizedExplicitProjects.length === 1) {
    return normalizedExplicitProjects[0];
  }

  if (options.staleFallbackProject) {
    return normalizeProjectPath(options.staleFallbackProject);
  }

  return null;
}
