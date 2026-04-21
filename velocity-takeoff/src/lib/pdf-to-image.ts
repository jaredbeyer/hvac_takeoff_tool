import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import path from 'path';
import { pathToFileURL } from 'url';

const RENDER_SCALE = 2;

// pdfjs can attempt to spin up a "fake worker" unless a workerSrc is provided.
// Provide a workerSrc so serverless runtimes don't error during initialization.
try {
  (pdfjs as any).GlobalWorkerOptions = (pdfjs as any).GlobalWorkerOptions || {};
  // In Vercel, `import.meta.url` rewriting can yield a `.next/server/chunks/...` URL
  // that doesn't exist at runtime. Point directly at the installed node_modules file.
  const workerAbsPath = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  );
  (pdfjs as any).GlobalWorkerOptions.workerSrc =
    pathToFileURL(workerAbsPath).toString();
} catch {
  // best-effort only
}

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
    // pdfjs-dist types for legacy build don't expose this, but it prevents
    // fake-worker setup (which fails in Vercel serverless bundling).
    disableWorker: true,
  } as any).promise;
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
  const doc = await pdfjs.getDocument({ data, disableWorker: true } as any).promise;
  return doc.numPages;
}
