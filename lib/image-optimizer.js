import sharp from 'sharp';

const MAX_SIZE_KB = 150;
const MAX_DIMENSION = 800;

/**
 * Optimize an image to be below 150KB, fast.
 * Strategy: decode + resize once (the expensive part for big uploads),
 * then re-encode the small buffer with falling quality, and finally
 * shrink dimensions as a guaranteed fallback.
 */
export async function optimizeImage(buffer) {
  // Decode and resize once — avoids re-processing the original repeatedly
  let outputBuffer = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  let quality = 80;

  // Re-encode the already-resized buffer (much faster than the original)
  while (outputBuffer.length > MAX_SIZE_KB * 1024 && quality > 20) {
    quality = Math.max(20, quality - 15);
    outputBuffer = await sharp(outputBuffer)
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  // Guaranteed fallback: shrink dimensions until under the cap
  let dimension = MAX_DIMENSION;
  while (outputBuffer.length > MAX_SIZE_KB * 1024 && dimension > 160) {
    dimension = Math.max(160, Math.floor(dimension * 0.75));
    outputBuffer = await sharp(outputBuffer)
      .resize(dimension, dimension, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: Math.min(quality, 60), effort: 4 })
      .toBuffer();
  }

  return {
    buffer: outputBuffer,
    sizeKB: Math.round(outputBuffer.length / 1024),
    quality,
  };
}

/**
 * Get image metadata
 */
export async function getImageMetadata(buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    sizeKB: Math.round(buffer.length / 1024),
  };
}
