/**
 * National average labor hours for HVAC ductwork and components.
 * Straight duct: TheProjectEstimate.com manhours per sq.ft by perimeter.
 * Fittings: TheProjectEstimate.com manhours per piece by perimeter.
 */
import { computeSheetMetalLbs } from './duct-calc';

// ---- Straight duct: perimeter (ft) → fab hrs/sq.ft, install hrs/sq.ft ----
const STRAIGHT_DUCT_TABLE: Array<{ perimeterFt: number; fabPerSf: number; installPerSf: number }> = [
  { perimeterFt: 4, fabPerSf: 0.154, installPerSf: 0.242 },
  { perimeterFt: 6.4, fabPerSf: 0.154, installPerSf: 0.242 },
  { perimeterFt: 8, fabPerSf: 0.176, installPerSf: 0.253 },
  { perimeterFt: 10, fabPerSf: 0.176, installPerSf: 0.253 },
  { perimeterFt: 11.2, fabPerSf: 0.176, installPerSf: 0.264 },
  { perimeterFt: 12, fabPerSf: 0.187, installPerSf: 0.286 },
  { perimeterFt: 14.6, fabPerSf: 0.209, installPerSf: 0.308 },
  { perimeterFt: 16, fabPerSf: 0.22, installPerSf: 0.33 },
  { perimeterFt: 17, fabPerSf: 0.242, installPerSf: 0.352 },
  { perimeterFt: 20, fabPerSf: 0.253, installPerSf: 0.374 },
  { perimeterFt: 25, fabPerSf: 0.253, installPerSf: 0.385 },
  { perimeterFt: 28.6, fabPerSf: 0.253, installPerSf: 0.385 },
  { perimeterFt: 32, fabPerSf: 0.264, installPerSf: 0.407 },
  { perimeterFt: 34.5, fabPerSf: 0.264, installPerSf: 0.407 },
];

// ---- Fittings: perimeter (ft) → hrs per piece by type ----
type FittingType = 'elbow' | 'tee' | 'wye' | 'tap_in' | 'offset_transition';

const FITTING_TABLE: Array<{
  perimeterFt: number;
  elbow: number;
  tee: number;
  wye: number;
  tap_in: number;
  offset_transition: number;
}> = [
  { perimeterFt: 4, elbow: 0.297, tee: 0.462, wye: 0.528, tap_in: 0.297, offset_transition: 0.385 },
  { perimeterFt: 6.4, elbow: 0.495, tee: 0.748, wye: 0.88, tap_in: 0.495, offset_transition: 0.495 },
  { perimeterFt: 8, elbow: 0.616, tee: 0.913, wye: 1.056, tap_in: 0.616, offset_transition: 0.616 },
  { perimeterFt: 10, elbow: 0.759, tee: 1.144, wye: 1.342, tap_in: 0.759, offset_transition: 0.759 },
  { perimeterFt: 11.2, elbow: 0.858, tee: 1.287, wye: 1.507, tap_in: 0.858, offset_transition: 0.858 },
  { perimeterFt: 12, elbow: 0.913, tee: 1.375, wye: 1.606, tap_in: 0.913, offset_transition: 0.913 },
  { perimeterFt: 14.6, elbow: 1.1, tee: 1.65, wye: 1.936, tap_in: 1.1, offset_transition: 1.1 },
  { perimeterFt: 16, elbow: 1.221, tee: 1.815, wye: 2.134, tap_in: 1.221, offset_transition: 1.221 },
  { perimeterFt: 17, elbow: 1.287, tee: 1.936, wye: 2.266, tap_in: 1.287, offset_transition: 1.287 },
  { perimeterFt: 20, elbow: 1.518, tee: 2.277, wye: 2.662, tap_in: 1.518, offset_transition: 1.518 },
  { perimeterFt: 25, elbow: 1.903, tee: 2.86, wye: 3.322, tap_in: 1.903, offset_transition: 1.903 },
  { perimeterFt: 28.6, elbow: 2.167, tee: 3.256, wye: 3.795, tap_in: 2.167, offset_transition: 2.167 },
  { perimeterFt: 32, elbow: 2.431, tee: 3.652, wye: 4.257, tap_in: 2.431, offset_transition: 2.431 },
  { perimeterFt: 34.5, elbow: 2.629, tee: 3.927, wye: 4.587, tap_in: 2.629, offset_transition: 2.629 },
];

function interpolate<T extends Record<string, number>>(
  table: Array<{ perimeterFt: number } & T>,
  perimeterFt: number,
  key: keyof T
): number {
  if (table.length === 0) return 0;
  if (perimeterFt <= table[0].perimeterFt) return table[0][key as keyof typeof table[0]];
  if (perimeterFt >= table[table.length - 1].perimeterFt)
    return table[table.length - 1][key as keyof typeof table[0]];
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (perimeterFt >= a.perimeterFt && perimeterFt <= b.perimeterFt) {
      const t = (perimeterFt - a.perimeterFt) / (b.perimeterFt - a.perimeterFt);
      const va = a[key as keyof typeof a] as number;
      const vb = b[key as keyof typeof b] as number;
      return va + t * (vb - va);
    }
  }
  return table[table.length - 1][key as keyof typeof table[0]];
}

/** Rectangular duct perimeter in feet: 2*(W+H)/12 */
function rectPerimeterFt(widthInches: number, heightInches: number): number {
  return (2 * (widthInches + heightInches)) / 12;
}

/** Round duct perimeter in feet: π * diameter / 12 */
function roundPerimeterFt(diameterInches: number): number {
  return (Math.PI * diameterInches) / 12;
}

function inferFittingType(description: string | null): FittingType {
  const d = (description ?? '').toLowerCase();
  if (/\b(tee|t-piece|t-fitting)\b/i.test(d)) return 'tee';
  if (/\b(wye|y-piece|y-fitting)\b/i.test(d)) return 'wye';
  if (/\b(tap|takeoff|take-off)\b/i.test(d)) return 'tap_in';
  if (/\b(offset|transition|reducer)\b/i.test(d)) return 'offset_transition';
  return 'elbow'; // elbow, 90°, 45°, or unknown
}

// Non-duct components
const AIR_DEVICE_HRS_PER_EA = 0.3;
const EQUIPMENT_HRS_PER_EA = 1.5;
const PIPE_HRS_PER_EA = 0.5;
const INSULATION_HRS_PER_LF = 0.02;
const ACCESSORY_HRS_PER_EA = 0.25;

export interface LaborHrs {
  installHrs: number;
  fabHrs: number;
}

/**
 * Compute national-average install and fab labor hours for a line item.
 * Straight duct uses hrs/sq.ft by perimeter; fittings use hrs/piece by type.
 */
export function computeLaborHrs(
  componentType: string,
  size: string | null,
  quantity: number,
  unit: string,
  linearFeet: number | null,
  lbs: number | null,
  gauge: string | null,
  description?: string | null
): LaborHrs | null {
  const lf = linearFeet ?? (unit === 'LF' ? quantity : null);

  switch (componentType) {
    case 'rectangular_duct': {
      const rectMatch = size?.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (!rectMatch || lf == null || lf <= 0) return null;
      const w = parseInt(rectMatch[1], 10);
      const h = parseInt(rectMatch[2], 10);
      const perimeterFt = rectPerimeterFt(w, h);
      const surfaceSf = perimeterFt * lf;
      const fabPerSf = interpolate(STRAIGHT_DUCT_TABLE, perimeterFt, 'fabPerSf');
      const installPerSf = interpolate(STRAIGHT_DUCT_TABLE, perimeterFt, 'installPerSf');
      return {
        fabHrs: surfaceSf * fabPerSf,
        installHrs: surfaceSf * installPerSf,
      };
    }
    case 'round_duct':
    case 'flex_duct': {
      const roundMatch = size?.match(/(\d+)/);
      if (!roundMatch || lf == null || lf <= 0) return null;
      const diam = parseInt(roundMatch[1], 10);
      const perimeterFt = roundPerimeterFt(diam);
      const surfaceSf = perimeterFt * lf;
      const fabPerSf = interpolate(STRAIGHT_DUCT_TABLE, perimeterFt, 'fabPerSf');
      const installPerSf = interpolate(STRAIGHT_DUCT_TABLE, perimeterFt, 'installPerSf');
      if (componentType === 'flex_duct') {
        return {
          fabHrs: surfaceSf * 0.02,
          installHrs: surfaceSf * installPerSf,
        };
      }
      return {
        fabHrs: surfaceSf * fabPerSf,
        installHrs: surfaceSf * installPerSf,
      };
    }
    case 'fitting': {
      const fittingType = inferFittingType(description ?? null);
      let perimeterFt = 0;

      const rectMatch = size?.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (rectMatch) {
        const w = parseInt(rectMatch[1], 10);
        const h = parseInt(rectMatch[2], 10);
        perimeterFt = rectPerimeterFt(w, h);
      } else {
        const roundMatch = size?.match(/(\d+)/);
        if (roundMatch) {
          const diam = parseInt(roundMatch[1], 10);
          perimeterFt = roundPerimeterFt(diam);
        }
      }

      const fittingLbs = lbs ?? computeSheetMetalLbs('fitting', size, null, quantity, gauge);
      const fabHrsPerLb = 0.023;

      if (perimeterFt <= 0) {
        if (fittingLbs == null || fittingLbs <= 0) return null;
        const installHrsPerLb = 0.04;
        return {
          fabHrs: fittingLbs * fabHrsPerLb,
          installHrs: fittingLbs * installHrsPerLb,
        };
      }

      if (perimeterFt < FITTING_TABLE[0].perimeterFt) {
        perimeterFt = FITTING_TABLE[0].perimeterFt;
      }

      const installHrsPerPc = interpolate(FITTING_TABLE, perimeterFt, fittingType);
      return {
        fabHrs: fittingLbs != null && fittingLbs > 0 ? fittingLbs * fabHrsPerLb : 0,
        installHrs: quantity * installHrsPerPc,
      };
    }
    case 'air_device':
      return { installHrs: quantity * AIR_DEVICE_HRS_PER_EA, fabHrs: 0 };
    case 'equipment':
      return { installHrs: quantity * EQUIPMENT_HRS_PER_EA, fabHrs: 0 };
    case 'pipe':
      return { installHrs: quantity * PIPE_HRS_PER_EA, fabHrs: 0 };
    case 'insulation':
      return {
        installHrs: (lf ?? quantity) * INSULATION_HRS_PER_LF,
        fabHrs: 0,
      };
    case 'accessory':
      return { installHrs: quantity * ACCESSORY_HRS_PER_EA, fabHrs: 0 };
    default:
      return null;
  }
}

/** Default national average install rate ($/hr) when no pricing profile */
export const DEFAULT_INSTALL_RATE = 55;
/** Default national average fab rate ($/hr) when no pricing profile */
export const DEFAULT_FAB_RATE = 48;
