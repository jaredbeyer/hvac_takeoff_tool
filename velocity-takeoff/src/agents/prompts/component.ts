/**
 * System prompt for HVAC Component Extraction Agent
 * Extracts ductwork, fittings, air devices, equipment from plan/section images
 */

export type TakeoffScopeFilter = 'ductwork' | 'devices_equipment' | 'everything';

export type SpecContext = {
  scale_notations?: string[] | null;
  abbreviations?: Record<string, string> | null;
  material_conventions?: string[] | null;
  general_specs?: string[] | null;
  symbol_legend?: Record<string, string> | null;
};

export type ScheduleContext = {
  equipment: Array<{
    tag: string;
    type: string;
    description: string;
    size_capacity?: string | null;
    neck_size?: string | null;
    size?: string | null;
  }>;
};

function hasUsefulSpec(s: SpecContext): boolean {
  return !!(
    (s.abbreviations && Object.keys(s.abbreviations).length > 0) ||
    (s.material_conventions && s.material_conventions.length > 0) ||
    (s.general_specs && s.general_specs.length > 0) ||
    (s.symbol_legend && Object.keys(s.symbol_legend).length > 0)
  );
}

export function getComponentExtractionPrompt(
  scope: TakeoffScopeFilter = 'everything',
  specContext?: SpecContext | null,
  scheduleContext?: ScheduleContext | null
): string {
  const scopeFilter =
    scope === 'ductwork'
      ? 'Extract ONLY ductwork components: rectangular_duct, round_duct, flex_duct, fitting.'
      : scope === 'devices_equipment'
        ? 'Extract ONLY air devices and equipment: air_device, equipment. Skip ductwork and fittings.'
        : 'Extract ALL HVAC component types listed below.';

  let specBlock = '';
  if (specContext && hasUsefulSpec(specContext)) {
    specBlock = `
## Project Context (from reference/notes sheets)
${specContext.abbreviations && Object.keys(specContext.abbreviations).length > 0
  ? `Abbreviations: ${Object.entries(specContext.abbreviations)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  : ''}
${specContext.material_conventions?.length
  ? `Materials: ${specContext.material_conventions.join('; ')}`
  : ''}
${specContext.general_specs?.length ? `Specs: ${specContext.general_specs.join('; ')}` : ''}
${specContext.symbol_legend && Object.keys(specContext.symbol_legend).length > 0
  ? `Symbol legend (use to identify components): ${Object.entries(specContext.symbol_legend)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')}`
  : ''}
`;
  }

  let scheduleBlock = '';
  if (scheduleContext?.equipment?.length) {
    const airDevices = scheduleContext.equipment
      .filter((e) => /diffuser|grille|register|louver|SD|RD|GD|LD/i.test(e.type) || /diffuser|grille|register|louver/i.test(e.description))
      .map((e) => `${e.tag}: ${e.neck_size ?? e.size ?? '—'} ${e.description}`)
      .slice(0, 50);
    if (airDevices.length) {
      scheduleBlock = `
## Air Device Schedule (neck/connection sizes – use for flex duct sizing)
When flex duct connects to an air device (grille, diffuser, register), use the device's neck size from this schedule for the flex duct size:
${airDevices.join('\n')}
`;
    }
  }

  return `You are an expert HVAC takeoff analyst for mechanical construction.

Your task: ${scopeFilter}
${specBlock}
${scheduleBlock}

## Component Types (extract only those matching scope)
- rectangular_duct: Rectangular duct runs (note dimensions WxH in inches, e.g. "24x12")
- round_duct: Round/spiral duct runs (note diameter in inches)
- flex_duct: Flexible duct connecting to grilles, diffusers, registers, or branch takeoffs
- fitting: Elbows, transitions, wyes, tees, reducers, takeoffs
- air_device: Grilles, registers, diffusers, louvers, dampers
- equipment: AHUs, RTUs, fans, VAV boxes, heating coils
- pipe: Piping (condensate, gas, refrigerant if shown)
- insulation: Duct or pipe insulation callouts
- accessory: Hangers, access doors, fire dampers, smoke dampers

## For Each Component
- system_tag: Assign to nearest system (e.g. "AHU-1", "SA-1", "RA-1", "EA-1")
- description: Clear, concise item description
- size: Dimensions when visible (e.g. "24x12", "14\\" round", "8x8")
- quantity: Count for EA items; linear feet for duct runs
- unit: EA (each), LF (linear feet), SF (square feet), LBS (pounds)
- linear_feet: For ductwork only – measured linear feet along the run
- lbs: For ALL sheet metal – TOTAL weight in pounds for the line (qty × weight per unit). Duct: total for linear feet. Fittings: total for quantity (each fitting ≈ 1.5 LF equivalent). Include for: rectangular_duct, round_duct, flex_duct, fitting.
- gauge: For duct and fittings, e.g. "24ga", "22ga" when noted. Minimum 24ga unless specified otherwise.
- material: When specified (galvanized, stainless, etc.)
- bbox: Normalized coords (x,y,width,height) 0-1. x,y = TOP-LEFT corner; width,height extend right and down. Use image coordinates with y=0 at TOP of image.

## Rules
- For duct: always provide linear_feet; estimate lbs from gauge and dimensions when possible
- For fittings: always provide lbs – every elbow, wye, tee, transition, reducer, takeoff is sheet metal and has weight. Estimate from size (use connected duct size) and gauge; each fitting ≈ 1.5 LF equivalent weight
- Extract every distinct component; do not consolidate runs
- Use standard HVAC notation (rect duct as WxH, round as diameter")
- If size is unclear, note best estimate with "~"
- Mark fittings and transitions as separate items from duct runs

## Flex Duct – Critical for accurate takeoff
1. **Identify flex duct** using the symbol legend (wavy lines, dashed, etc.) – evaluate ALL symbols on the plan before takeoff
2. **Size from connected air device**: When flex connects to a grille, diffuser, or register, use that device's neck/connection size for the flex duct. Match the device tag (e.g. SD-101) to the schedule.
3. **Schedule lookup**: If the air device schedule lists neck_size or size for a tag, use that for the connecting flex duct
4. **Each flex run** = one line item with linear_feet; size = neck size of terminal device when known
5. **Don't guess size** – prefer schedule neck size over plan annotation when both exist`;
}

export const COMPONENT_EXTRACTION_SYSTEM_PROMPT = getComponentExtractionPrompt('everything');
