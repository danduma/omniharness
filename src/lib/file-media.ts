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

const VIDEO_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
};

export function videoMimeTypeForPath(filePath: string): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(filePath)?.[1]?.toLowerCase();
  return extension ? VIDEO_MIME_TYPES_BY_EXTENSION[extension] ?? null : null;
}

export function isVideoPath(filePath: string) {
  return videoMimeTypeForPath(filePath) !== null;
}
