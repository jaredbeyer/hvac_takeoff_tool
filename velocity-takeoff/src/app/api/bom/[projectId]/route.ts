import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { recordTakeoffPattern } from '@/lib/takeoff-patterns';
import { z } from 'zod';

const lineItemUpdateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().optional(),
  size: z.string().nullable().optional(),
  quantity: z.number().optional(),
  unit: z.enum(['EA', 'LF', 'SF', 'LBS']).optional(),
  gauge: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  needs_review: z.boolean().optional(),
  human_verified: z.boolean().optional(),
});

const patchBodySchema = z.object({
  updates: z.array(lineItemUpdateSchema).min(1).max(100),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project exists (RLS)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  const { data: sheets } = await supabase
    .from('sheets')
    .select('id, page_num, sheet_number, sheet_title, filename, analysis_status, analysis_region, analysis_error, analysis_error_source')
    .eq('project_id', projectId)
    .order('page_num');

  if (!sheets?.length) {
    return NextResponse.json({ line_items: [], sheets: [] });
  }

  const sheetIds = sheets.map((s) => s.id);
  const { data: lineItems, error: itemsError } = await supabase
    .from('line_items')
    .select('*')
    .in('sheet_id', sheetIds)
    .order('sheet_id')
    .order('created_at');

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    project_id: projectId,
    sheets,
    line_items: lineItems ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = patchBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const update of parsed.data.updates) {
    const { id, ...rest } = update;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) {
      results.push({ id, success: true });
      continue;
    }

    const { data: updated, error } = await supabase
      .from('line_items')
      .update(clean)
      .eq('id', id)
      .select('component_type, size, material, gauge, description')
      .single();

    if (error) {
      results.push({ id, success: false, error: error.message });
    } else {
      results.push({ id, success: true });
      if (clean.human_verified === true && updated) {
        recordTakeoffPattern(supabase, user.id, updated).catch(() => {});
      }
    }
  }

  return NextResponse.json({ updated: results });
}
