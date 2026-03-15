import type { SpecExtractionOutput } from '@/agents/schemas';

/**
 * Merges multiple spec extractions from REFERENCE sheets into a single project context.
 */
export function mergeSpecContext(
  extractions: (SpecExtractionOutput | null)[]
): SpecExtractionOutput {
  const scaleNotations = new Set<string>();
  const abbreviations: Record<string, string> = {};
  const materialConventions: string[] = [];
  const generalSpecs: string[] = [];
  const symbolLegend: Record<string, string> = {};

  for (const ex of extractions) {
    if (!ex) continue;
    ex.scale_notations?.forEach((s) => scaleNotations.add(s));
    if (ex.abbreviations) {
      for (const [k, v] of Object.entries(ex.abbreviations)) {
        const key = k.toUpperCase().trim();
        if (key && v) abbreviations[key] = v;
      }
    }
    ex.material_conventions?.forEach((m) => {
      if (m && !materialConventions.includes(m)) materialConventions.push(m);
    });
    ex.general_specs?.forEach((g) => {
      if (g && !generalSpecs.includes(g)) generalSpecs.push(g);
    });
    if (ex.symbol_legend) {
      for (const [k, v] of Object.entries(ex.symbol_legend)) {
        if (k && v) symbolLegend[k] = v;
      }
    }
  }

  return {
    scale_notations:
      scaleNotations.size > 0 ? Array.from(scaleNotations) : null,
    abbreviations:
      Object.keys(abbreviations).length > 0 ? abbreviations : null,
    material_conventions:
      materialConventions.length > 0 ? materialConventions : null,
    general_specs: generalSpecs.length > 0 ? generalSpecs : null,
    symbol_legend:
      Object.keys(symbolLegend).length > 0 ? symbolLegend : null,
  };
}