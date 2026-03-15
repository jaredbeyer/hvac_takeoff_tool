import type { SupabaseClient } from '@supabase/supabase-js';

type LineItemForPattern = {
  component_type: string;
  size: string | null;
  material: string | null;
  gauge: string | null;
  description: string | null;
};

/**
 * Records a takeoff pattern when user marks a line item as human_verified.
 * Upserts into takeoff_patterns for future prompt enrichment.
 */
export async function recordTakeoffPattern(
  supabase: SupabaseClient,
  userId: string,
  item: LineItemForPattern
): Promise<void> {
  const size = item.size ?? '';
  const material = item.material ?? '';
  const gauge = item.gauge ?? '';
  const descPattern = (item.description ?? '').slice(0, 200);

  const { data: existing } = await supabase
    .from('takeoff_patterns')
    .select('id, frequency')
    .eq('created_by', userId)
    .eq('component_type', item.component_type)
    .eq('size', size)
    .eq('material', material)
    .eq('gauge', gauge)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('takeoff_patterns')
      .update({
        frequency: existing.frequency + 1,
        last_used_at: new Date().toISOString(),
        description_pattern: descPattern || undefined,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('takeoff_patterns').insert({
      created_by: userId,
      component_type: item.component_type,
      size: size || null,
      material: material || null,
      gauge: gauge || null,
      description_pattern: descPattern || null,
      frequency: 1,
    });
  }
}