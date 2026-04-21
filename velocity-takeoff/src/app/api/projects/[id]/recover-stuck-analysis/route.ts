import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';

/**
 * Resets sheets stuck in queued/processing (e.g. after Vercel 504) and returns project to draft.
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
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  await supabase.from('projects').update({ status: 'draft' }).eq('id', projectId);

  const { data: stuck, error: selectError } = await supabase
    .from('sheets')
    .select('id')
    .eq('project_id', projectId)
    .in('analysis_status', ['queued', 'processing']);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const ids = (stuck ?? []).map((s) => s.id);
  if (ids.length === 0) {
    return NextResponse.json({
      project_id: projectId,
      reset_count: 0,
      message: 'No sheets in queued or processing state',
    });
  }

  const { error: updateError } = await supabase
    .from('sheets')
    .update({
      analysis_status: 'pending',
      analysis_error: null,
      analysis_error_source: null,
    })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    project_id: projectId,
    reset_count: ids.length,
    sheet_ids: ids,
  });
}
