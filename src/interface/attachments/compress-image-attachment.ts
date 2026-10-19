"use client";

// Images are re-encoded in the browser before upload so a phone screenshot
// does not travel to the runner, sit on disk, and get base64-inlined into the
// agent prompt at full PNG size. Models downscale anything past ~2000px on the
// long edge anyway, so this keeps the pixels the model actually sees.
export const IMAGE_ATTACHMENT_MAX_EDGE_PX = 2048;
export const IMAGE_ATTACHMENT_JPEG_QUALITY = 0.85;
// Below this size an image that already fits the edge limit is left alone;
// re-encoding it would cost quality for no meaningful saving.
export const IMAGE_ATTACHMENT_COMPRESS_THRESHOLD_BYTES = 300 * 1024;

// GIFs may be animated and SVGs are vectors; re-encoding either loses content.
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp"]);

type DrawingCanvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): DrawingCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function encodeCanvas(canvas: DrawingCanvas, type: string, quality?: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function hasTransparentPixels(data: Uint8ClampedArray) {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }
  return false;
}

function renameWithExtension(name: string, extension: string) {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${extension}`;
}

export function scaledImageDimensions(width: number, height: number, maxEdge = IMAGE_ATTACHMENT_MAX_EDGE_PX) {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Downscale and re-encode an image attachment. Opaque images become JPEG;
 * images with transparency stay PNG so logos and icons keep their alpha.
 * Returns the original file whenever the browser cannot decode it or the
 * re-encoded result would not be smaller.
 */
export async function compressImageAttachment(file: File, name = file.name): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const target = scaledImageDimensions(bitmap.width, bitmap.height);
    const needsResize = target.width !== bitmap.width || target.height !== bitmap.height;
    if (!needsResize && file.size <= IMAGE_ATTACHMENT_COMPRESS_THRESHOLD_BYTES) {
      return file;
    }

    const canvas = createCanvas(target.width, target.height);
    const context = canvas?.getContext("2d", { willReadFrequently: true }) as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
      | undefined;
    if (!canvas || !context) {
      return file;
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const transparent = file.type !== "image/jpeg"
      && hasTransparentPixels(context.getImageData(0, 0, target.width, target.height).data);
    const [mimeType, extension, quality] = transparent
      ? ["image/png", "png", undefined] as const
      : ["image/jpeg", "jpg", IMAGE_ATTACHMENT_JPEG_QUALITY] as const;

    const blob = await encodeCanvas(canvas, mimeType, quality);
    if (!blob || blob.type !== mimeType || blob.size >= file.size) {
      return file;
    }

    return new File([blob], renameWithExtension(name, extension), {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
