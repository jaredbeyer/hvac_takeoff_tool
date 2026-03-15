import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const RENDER_SCALE = 2;

/**
 * Convert a PDF page to PNG buffer.
 * Uses pdfjs-dist + @napi-rs/canvas for serverless compatibility.
 */
export async function renderPdfPageToPng(
  pdfBuffer: Buffer,
  pageNum: number
): Promise<Buffer> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return Buffer.from(canvas.toBuffer('image/png'));
}

/**
 * Get the number of pages in a PDF.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  return doc.numPages;
}
