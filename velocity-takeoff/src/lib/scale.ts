/**
 * Parse an architectural scale string into a numeric ratio.
 * Supported formats: "1/4\" = 1'-0\"", "1/8\" = 1'-0\"", "1\" = 10'", etc.
 * @returns scaleRatio = feet of real length per inch on the drawing
 * @throws if format is unrecognized
 */
export function parseScale(scaleStr: string): number {
  const trimmed = scaleStr.trim();
  if (!trimmed) throw new Error('Scale string is empty');

  // Match: 1/4" = 1'-0" or 1/8" = 1'-0" or 1" = 10'
  const architecturalMatch = trimmed.match(
    /^(\d+)\/(\d+)"\s*=\s*(\d+)'-(\d+)"$/i
  );
  if (architecturalMatch) {
    const [, num, denom, feet, inches] = architecturalMatch;
    const drawingInches = Number(num) / Number(denom);
    const realInches = Number(feet) * 12 + Number(inches);
    return realInches / drawingInches / 12; // feet per inch on drawing
  }

  // Match: 1/4" = 10' or 1" = 10' (drawing inch = real feet)
  const simpleMatch = trimmed.match(/^(\d+)\/(\d+)"\s*=\s*(\d+)'$/i);
  if (simpleMatch) {
    const [, num, denom, feet] = simpleMatch;
    const drawingInches = Number(num) / Number(denom);
    return Number(feet) / drawingInches;
  }

  // Match: 1" = 10' (whole inch = feet)
  const wholeInchMatch = trimmed.match(/^1"\s*=\s*(\d+)'$/i);
  if (wholeInchMatch) {
    return Number(wholeInchMatch[1]);
  }

  throw new Error(`Unrecognized scale format: ${scaleStr}`);
}

/**
 * Calculate pixels per real-world foot for a scaled drawing image.
 * Assumes the image was scanned/rendered at the given DPI.
 * @param scaleRatio - Feet of real length per inch on the drawing (from parseScale)
 * @param dpi - Image resolution (e.g., 96 for screen, 150–300 for print)
 * @returns Pixels that represent 1 foot in the real world
 */
export function calculatePixelsPerFoot(scaleRatio: number, dpi: number): number {
  // 1 foot in real world = (1 / scaleRatio) inches on the drawing
  // 1 inch on drawing at dpi = dpi pixels
  const inchesOnDrawing = 1 / scaleRatio;
  return inchesOnDrawing * dpi;
}
