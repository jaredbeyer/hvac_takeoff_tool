import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/storage/url?bucket=sheet-images|project-pdfs&path=projectId/sheetId.png
 * Returns a signed URL for accessing private storage. Requires auth.
 */
export async function GET(request: Request) {
  const supabaseAuth = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get('bucket');
  const path = searchParams.get('path');

  if (!bucket || !path) {
    return NextResponse.json(
      { error: 'Missing bucket or path query params' },
      { status: 400 }
    );
  }

  if (bucket !== 'sheet-images' && bucket !== 'project-pdfs') {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
  }

  // Verify user owns the project (path format: projectId/...)
  const projectId = path.split('/')[0];
  const { data: project } = await supabaseAuth
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to create URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
