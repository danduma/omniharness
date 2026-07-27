export type ProjectFileReference = {
  root: string;
  relativePath: string;
  line?: number;
  column?: number;
};

export function buildProjectFileFullPath({ root, relativePath }: Pick<ProjectFileReference, "root" | "relativePath">) {
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  const trimmedRoot = root.replace(/[\\/]+$/, "");
  const trimmedRelativePath = relativePath
    .replace(/^[\\/]+/, "")
    .replace(separator === "\\" ? /\//g : /\\/g, separator);

  return `${trimmedRoot || separator}${trimmedRoot ? separator : ""}${trimmedRelativePath}`;
}

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function decodePathSegments(value: string) {
  return value.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
}

function normalizePath(value: string) {
  return decodePathSegments(value)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function trimReference(value: string) {
  return value.trim().replace(/[)\].,;]+$/, "");
}

function extractCandidatePath(value: string): string | null {
  const trimmed = trimReference(value);
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol) || !LOCALHOST_NAMES.has(url.hostname)) {
      return null;
    }
    return url.pathname;
  } catch {
    return trimmed;
  }
}

function stripLineColumn(value: string) {
  const match = value.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match) {
    return { pathPart: value };
  }

  return {
    pathPart: match[1],
    line: Number(match[2]),
    column: match[3] ? Number(match[3]) : undefined,
  };
}

function isSafeRelativeProjectPath(value: string) {
  if (
    !value
    || value.startsWith("/")
    || /^[a-z][a-z0-9+.-]*:/i.test(value)
    || value.includes("\0")
    || /\s/.test(value)
  ) {
    return false;
  }

  const normalized = value.replace(/^\.\//, "");
  return Boolean(
    normalized
    && normalized.includes("/")
    && !normalized.startsWith("../")
    && normalized !== ".."
    && !normalized.includes("/../")
    && !normalized.endsWith("/..")
  );
}

export function parseProjectFileReference(value: string, projectRoot: string | null | undefined): ProjectFileReference | null {
  const root = normalizePath(projectRoot ?? "");
  if (!root) {
    return null;
  }

  const candidate = extractCandidatePath(value);
  if (!candidate) {
    return null;
  }

  const { pathPart, line, column } = stripLineColumn(normalizePath(candidate));
  if (isSafeRelativeProjectPath(pathPart)) {
    return {
      root,
      relativePath: pathPart.replace(/^\.\//, ""),
      ...(line ? { line } : {}),
      ...(column ? { column } : {}),
    };
  }

  if (pathPart !== root && !pathPart.startsWith(`${root}/`)) {
    return null;
  }

  const relativePath = pathPart.slice(root.length).replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("\0")) {
    return null;
  }

  return {
    root,
    relativePath,
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
  };
}
