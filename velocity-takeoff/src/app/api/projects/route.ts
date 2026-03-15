import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { parseScale } from '@/lib/scale';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1),
  client: z.string().nullable().optional(),
  bid_date: z.string().nullable().optional(),
  default_scale: z.string().min(1),
});

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, client, bid_date, default_scale } = parsed.data;

  let scaleRatio: number;
  try {
    scaleRatio = parseScale(default_scale);
  } catch {
    return NextResponse.json(
      { error: 'Invalid scale format', example: '1/4" = 1\'-0"' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      client: client ?? null,
      bid_date: bid_date ?? null,
      default_scale,
      scale_ratio: scaleRatio,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
