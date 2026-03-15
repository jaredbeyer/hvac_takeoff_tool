import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { deleteSheetImage } from '@/lib/storage';
import { z } from 'zod';

const analysisRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const patchBodySchema = z.object({
  analysis_region: analysisRegionSchema.nullable().optional(),
  analysis_status: z.enum(['pending']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sheetId: string }> }
) {
  const { id: projectId, sheetId } = await params;

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

  const { analysis_region, analysis_status } = parsed.data;
  const update: Record<string, unknown> = {};
  if (analysis_region !== undefined) update.analysis_region = analysis_region;
  if (analysis_status === 'pending') {
    const { data: sheet } = await supabase
      .from('sheets')
      .select('analysis_status')
      .eq('id', sheetId)
      .eq('project_id', projectId)
      .single();
    if (sheet?.analysis_status && ['queued', 'processing'].includes(sheet.analysis_status)) {
      update.analysis_status = 'pending';
      update.analysis_error = null;
      update.analysis_error_source = null;
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true });
  }
  const { error } = await supabase
    .from('sheets')
    .update(update)
    .eq('id', sheetId)
    .eq('project_id', projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sheetId: string }> }
) {
  const { id: projectId, sheetId } = await params;

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

  const { data: sheet, error: fetchError } = await supabase
    .from('sheets')
    .select('id, image_path')
    .eq('id', sheetId)
    .eq('project_id', projectId)
    .single();

  if (fetchError || !sheet) {
    return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
  }

  try {
    if (sheet.image_path) {
      await deleteSheetImage(sheet.image_path);
    }
  } catch {
    // Continue to delete DB row even if storage delete fails
  }

  const { error: deleteError } = await supabase
    .from('sheets')
    .delete()
    .eq('id', sheetId)
    .eq('project_id', projectId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
