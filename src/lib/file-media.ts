/**
 * Image types the file viewer can draw, keyed by lowercase extension.
 *
 * The map is the whole allowlist: the raw-bytes route serves a project file
 * only when its extension lands here, so an entry is also a decision that the
 * bytes are safe to hand back verbatim.
 */
const IMAGE_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export function imageMimeTypeForPath(filePath: string): string | null {
  const name = filePath.split(/[\\/]/).pop() ?? "";
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return extension ? IMAGE_MIME_TYPES_BY_EXTENSION[extension] ?? null : null;
}

export function isImagePath(filePath: string) {
  return imageMimeTypeForPath(filePath) !== null;
}
