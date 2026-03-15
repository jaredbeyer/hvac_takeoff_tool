import { createServerClient } from './supabase-server';

const BUCKET_PDFS = 'project-pdfs';
const BUCKET_IMAGES = 'sheet-images';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Upload a PDF file to Supabase Storage.
 * @param projectId - Project UUID
 * @param file - PDF file buffer or Blob
 * @param filename - Original filename
 * @returns Storage path on success
 */
export async function uploadPDF(
  projectId: string,
  file: Buffer | Blob,
  filename: string
): Promise<string> {
  const supabase = createServerClient();
  const path = `${projectId}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET_PDFS)
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;
  return path;
}

/**
 * Upload a sheet image (PNG/JPEG) to Supabase Storage.
 * @param projectId - Project UUID
 * @param sheetId - Sheet UUID
 * @param file - Image buffer or Blob
 * @param mimeType - e.g. 'image/png'
 * @returns Storage path on success
 */
export async function uploadSheetImage(
  projectId: string,
  sheetId: string,
  file: Buffer | Blob,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<string> {
  const supabase = createServerClient();
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${projectId}/${sheetId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_IMAGES)
    .upload(path, file, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;
  return path;
}

/**
 * Get a signed URL for temporary access to a stored file.
 * @param bucket - Bucket name
 * @param path - Storage path
 * @param expiresIn - Seconds until expiry (default 1 hour)
 */
export async function getSignedUrl(
  bucket: 'project-pdfs' | 'sheet-images',
  path: string,
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}

/**
 * Get image URL for analysis. If region specified, crops and uploads cropped version.
 * @param imagePath - Storage path (from sheets.image_path)
 * @param region - Optional normalized {x,y,width,height} 0-1 to crop
 */
export async function getSheetImageForAnalysis(
  imagePath: string,
  region?: { x: number; y: number; width: number; height: number } | null
): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_IMAGES)
    .download(imagePath);

  if (error) throw error;
  if (!data) throw new Error('Image not found');

  const buffer = Buffer.from(await data.arrayBuffer());

  if (region && region.width > 0 && region.height > 0) {
    const { cropImageToRegion } = await import('./image-crop');
    const cropped = await cropImageToRegion(buffer, region);
    const cropPath = imagePath.replace(/\.[^.]+$/, '_crop.png');
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_IMAGES)
      .upload(cropPath, cropped, { contentType: 'image/png', upsert: true });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = await supabase.storage
      .from(BUCKET_IMAGES)
      .createSignedUrl(cropPath, SIGNED_URL_EXPIRY);
    if (!urlData?.signedUrl) throw new Error('Failed to create signed URL');
    return urlData.signedUrl;
  }

  const { data: urlData } = await supabase.storage
    .from(BUCKET_IMAGES)
    .createSignedUrl(imagePath, SIGNED_URL_EXPIRY);
  if (!urlData?.signedUrl) throw new Error('Failed to create signed URL');
  return urlData.signedUrl;
}

/**
 * Remove a sheet image from storage.
 * @param imagePath - Storage path (from sheets.image_path)
 */
export async function deleteSheetImage(imagePath: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.storage
    .from(BUCKET_IMAGES)
    .remove([imagePath]);
  if (error) throw error;
}

/**
 * Fetch a sheet image and return as base64 data URL.
 * Used for AI analysis (e.g., sending to vision APIs).
 * @param imagePath - Storage path (from sheets.image_path)
 */
export async function getSheetImageBase64(imagePath: string): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_IMAGES)
    .download(imagePath);

  if (error) throw error;
  if (!data) throw new Error('Image not found');

  const bytes = await data.arrayBuffer();
  const b64 = Buffer.from(bytes).toString('base64');
  const mime = data.type || 'image/png';
  return `data:${mime};base64,${b64}`;
}
