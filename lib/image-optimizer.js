import sharp from 'sharp';

const MAX_SIZE_KB = 150;
const MAX_DIMENSION = 800;
const MAX_ITERATIONS = 5;

/**
 * Optimize an image to be below 150KB
 * Uses Sharp for server-side processing
 */
export async function optimizeImage(buffer) {
  let quality = 80;
  let iteration = 0;
  let outputBuffer = buffer;

  // First, resize to max dimensions
  outputBuffer = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  // Iteratively reduce quality until under 150KB
  while (outputBuffer.length > MAX_SIZE_KB * 1024 && iteration < MAX_ITERATIONS) {
    quality = Math.max(10, quality - 10);
    outputBuffer = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    iteration++;
  }

  // If still too large, reduce dimensions
  if (outputBuffer.length > MAX_SIZE_KB * 1024) {
    let scale = 0.8;
    while (outputBuffer.length > MAX_SIZE_KB * 1024 && scale > 0.2) {
      const newWidth = Math.floor(MAX_DIMENSION * scale);
      outputBuffer = await sharp(buffer)
        .resize(newWidth, null, { withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
      scale -= 0.1;
    }
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
