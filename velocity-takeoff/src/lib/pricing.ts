/**
 * Standard gauge steel weights (lbs per square foot) for HVAC ductwork.
 * Source: SMACNA / industry standards.
 */
const GAUGE_WEIGHT_LBS_PER_SF: Record<string, number> = {
  '26ga': 0.9,
  '24ga': 1.15,
  '22ga': 1.5,
  '20ga': 1.88,
  '18ga': 2.5,
};

/**
 * Compute rectangular duct weight in lbs from dimensions and linear feet.
 * Surface area SF = (perimeter in ft) × length ft; weight = SF × lbs_per_sf.
 */
export function computeRectDuctLbs(
  widthInches: number,
  heightInches: number,
  lengthFeet: number,
  gauge: string
): number {
  const weightPerSf = GAUGE_WEIGHT_LBS_PER_SF[gauge] ?? GAUGE_WEIGHT_LBS_PER_SF['22ga'];
  const perimeterInches = 2 * (widthInches + heightInches);
  const perimeterFeet = perimeterInches / 12;
  const surfaceSf = perimeterFeet * lengthFeet;
  return surfaceSf * weightPerSf;
}

/**
 * Compute round duct weight (approx) from diameter and linear feet.
 * Uses SMACNA spiral duct weight tables (simplified).
 */
const ROUND_DUCT_LBS_PER_LF: Record<string, number> = {
  '4': 1.2, '5': 1.5, '6': 1.8, '7': 2.1, '8': 2.5, '9': 2.9, '10': 3.3,
  '12': 4.1, '14': 4.9, '16': 5.8, '18': 6.7, '20': 7.6, '24': 9.4,
};

export function computeRoundDuctLbs(
  diameterInches: number,
  lengthFeet: number
): number {
  const key = String(Math.round(diameterInches));
  const lbsPerLf = ROUND_DUCT_LBS_PER_LF[key] ?? (diameterInches * 0.4);
  return lbsPerLf * lengthFeet;
}

/**
 * Price rectangular duct by weight and gauge.
 * Formula: (surface area SF) × (weight per SF for gauge) × (price per lb)
 * Rect duct surface = 2*(W+H)*L in feet, converted to SF.
 * @param widthInches - Duct width (in)
 * @param heightInches - Duct height (in)
 * @param lengthFeet - Length (ft)
 * @param gauge - e.g. '22ga'
 * @param pricePerLb - From pricing_profiles.rect_duct_price_per_lb
 */
export function priceRectangularDuct(
  widthInches: number,
  heightInches: number,
  lengthFeet: number,
  gauge: string,
  pricePerLb: number
): number {
  const weightPerSf = GAUGE_WEIGHT_LBS_PER_SF[gauge] ?? GAUGE_WEIGHT_LBS_PER_SF['22ga'];
  const perimeterInches = 2 * (widthInches + heightInches);
  const perimeterFeet = perimeterInches / 12;
  const surfaceSf = perimeterFeet * lengthFeet;
  const weightLbs = surfaceSf * weightPerSf;
  return weightLbs * pricePerLb;
}

/**
 * Round duct pricing by linear feet and diameter.
 * Uses pricing_profiles.round_duct_prices map: { "6": 3.50, "8": 4.25, ... }
 * @param diameterInches - Duct diameter (in)
 * @param lengthFeet - Length (ft)
 * @param roundDuctPrices - JSON map of diameter (string) -> $/LF
 */
export function priceRoundDuct(
  diameterInches: number,
  lengthFeet: number,
  roundDuctPrices: Record<string, number>
): number {
  const key = String(Math.round(diameterInches));
  const pricePerLf = roundDuctPrices[key] ?? roundDuctPrices['*'] ?? 0;
  return pricePerLf * lengthFeet;
}
