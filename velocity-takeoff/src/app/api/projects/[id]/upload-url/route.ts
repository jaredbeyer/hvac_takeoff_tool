import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { createServerClient } from '@/lib/supabase-server';

function sanitizeFilename(name: string): string {
  const base = (name || 'upload.pdf').split('/').pop() || 'upload.pdf';
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 180);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabaseAuth = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project exists and user owns it (RLS)
  const { data: project } = await supabaseAuth
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let filename = 'upload.pdf';
  try {
    const body = await request.json();
    if (typeof body?.filename === 'string') filename = body.filename;
  } catch {
    // ignore
  }

  const safeName = sanitizeFilename(filename);
  const uniquePrefix = crypto.randomUUID();
  const path = `${projectId}/${uniquePrefix}-${safeName}`;

  const supabaseService = createServerClient();
  const { data, error } = await supabaseService.storage
    .from('project-pdfs')
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.signedUrl || !data?.token) {
    return NextResponse.json(
      { error: 'Failed to create signed upload URL' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}

