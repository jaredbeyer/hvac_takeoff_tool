import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { z } from 'zod';

const patchBodySchema = z.object({
  takeoff_scope: z.enum(['ductwork', 'devices_equipment', 'everything']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .eq('id', id)
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

  const { takeoff_scope } = parsed.data;
  if (takeoff_scope === undefined) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('projects')
    .update({ takeoff_scope })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  const { data: sheets, error: sheetsError } = await supabase
    .from('sheets')
    .select('*')
    .eq('project_id', id)
    .order('page_num', { ascending: true });

  if (sheetsError) {
    return NextResponse.json(
      { error: sheetsError.message, project },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ...project,
    sheets: sheets ?? [],
  });
}
