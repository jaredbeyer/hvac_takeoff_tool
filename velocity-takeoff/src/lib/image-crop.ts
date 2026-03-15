import sharp from 'sharp';

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image buffer to a normalized region (0-1).
 * Returns cropped PNG buffer.
 */
export async function cropImageToRegion(
  buffer: Buffer,
  region: NormalizedRegion
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const w = metadata.width ?? 1;
  const h = metadata.height ?? 1;

  const left = Math.round(region.x * w);
  const top = Math.round(region.y * h);
  const cropW = Math.round(region.width * w);
  const cropH = Math.round(region.height * h);

  if (cropW < 1 || cropH < 1) return buffer;

  return sharp(buffer)
    .extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.min(cropW, w - left),
      height: Math.min(cropH, h - top),
    })
    .png()
    .toBuffer();
}
