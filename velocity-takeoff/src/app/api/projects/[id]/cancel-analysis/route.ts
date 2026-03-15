import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';

/**
 * Cancels pending/processing analysis: resets project to draft and any
 * processing sheets to pending so they can be retried.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  if (project.status !== 'analyzing') {
    return NextResponse.json({
      success: true,
      message: 'Project was not analyzing',
    });
  }

  await supabase
    .from('projects')
    .update({ status: 'draft' })
    .eq('id', projectId);

  const { data: activeSheets } = await supabase
    .from('sheets')
    .select('id')
    .eq('project_id', projectId)
    .in('analysis_status', ['processing', 'queued']);

  if (activeSheets?.length) {
    await supabase
      .from('sheets')
      .update({
        analysis_status: 'pending',
        analysis_error: null,
        analysis_error_source: null,
      })
      .eq('project_id', projectId)
      .in('analysis_status', ['processing', 'queued']);
  }

  return NextResponse.json({
    success: true,
    sheets_reset: activeSheets?.length ?? 0,
  });
}
