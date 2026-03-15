import { computeRectDuctLbs, computeRoundDuctLbs } from './pricing';

const DUCT_TYPES = ['rectangular_duct', 'round_duct', 'flex_duct'] as const;
const SHEET_METAL_TYPES = ['rectangular_duct', 'round_duct', 'flex_duct', 'fitting'] as const;

/** Equivalent LF of duct per fitting (elbows, wyes, tees, transitions, reducers, takeoffs) – SMACNA-based approx */
const FITTING_EQUIV_LF = 1.5;

/** Minimum duct gauge – 26ga is lighter than 24ga */
const GAUGE_ORDER = ['26ga', '24ga', '22ga', '20ga', '18ga'] as const;
function effectiveGauge(g: string | null): string {
  const gauge = g ?? '24ga';
  const idx = GAUGE_ORDER.indexOf(gauge as (typeof GAUGE_ORDER)[number]);
  const minIdx = GAUGE_ORDER.indexOf('24ga');
  if (idx >= 0 && idx < minIdx) return '24ga';
  return gauge;
}

/**
 * Compute duct weight in lbs from component data (straight duct runs).
 * Returns null if not computable.
 */
export function computeDuctLbs(
  componentType: string,
  size: string | null,
  linearFeet: number | null,
  gauge: string | null
): number | null {
  if (!DUCT_TYPES.includes(componentType as (typeof DUCT_TYPES)[number])) return null;
  const lf = linearFeet ?? 0;
  if (lf <= 0 || !size) return null;

  const g = effectiveGauge(gauge);

  // Rectangular: "24x12", "24×12"
  const rectMatch = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (rectMatch && componentType === 'rectangular_duct') {
    const w = parseInt(rectMatch[1], 10);
    const h = parseInt(rectMatch[2], 10);
    return computeRectDuctLbs(w, h, lf, g);
  }

  // Round: "14\"", "14 round", "14"
  const roundMatch = size.match(/(\d+)/);
  if (roundMatch && (componentType === 'round_duct' || componentType === 'flex_duct')) {
    const diam = parseInt(roundMatch[1], 10);
    return computeRoundDuctLbs(diam, lf);
  }

  return null;
}

/**
 * Compute fitting weight in lbs from size and quantity.
 * Fittings (elbows, wyes, tees, transitions, reducers, takeoffs) are sheet metal – estimate weight as equivalent LF of duct.
 */
export function computeFittingLbs(
  size: string | null,
  quantity: number,
  gauge: string | null
): number | null {
  if (!size || quantity <= 0) return null;
  const qty = quantity;
  const g = effectiveGauge(gauge);

  const rectMatch = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (rectMatch) {
    const w = parseInt(rectMatch[1], 10);
    const h = parseInt(rectMatch[2], 10);
    const lbsPerFitting = computeRectDuctLbs(w, h, FITTING_EQUIV_LF, g);
    return lbsPerFitting * qty;
  }

  const roundMatch = size.match(/(\d+)/);
  if (roundMatch) {
    const diam = parseInt(roundMatch[1], 10);
    const lbsPerFitting = computeRoundDuctLbs(diam, FITTING_EQUIV_LF);
    return lbsPerFitting * qty;
  }

  return null;
}

/**
 * Compute sheet metal weight (lbs) for any ductwork component: duct runs, fittings, etc.
 */
export function computeSheetMetalLbs(
  componentType: string,
  size: string | null,
  linearFeet: number | null,
  quantity: number,
  gauge: string | null
): number | null {
  if (!SHEET_METAL_TYPES.includes(componentType as (typeof SHEET_METAL_TYPES)[number])) return null;

  if (componentType === 'fitting') {
    return computeFittingLbs(size, quantity, gauge);
  }

  return computeDuctLbs(componentType, size, linearFeet, gauge);
}
