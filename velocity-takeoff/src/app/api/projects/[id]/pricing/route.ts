import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { z } from 'zod';

const DEFAULT_PROFILE = {
  rect_duct_price_per_lb: 2.5,
  round_duct_prices: { '6': 3.5, '8': 4.25, '10': 5, '12': 6, '14': 7.5 } as Record<string, number>,
  labor_rate_per_hour: 55,
  overhead_percent: 0,
  margin_percent: 0,
};

const patchBodySchema = z.object({
  rect_duct_price_per_lb: z.number().min(0).optional(),
  round_duct_prices: z.record(z.string(), z.number()).optional(),
  labor_rate_per_hour: z.number().min(0).optional(),
  national_avg_install_rate: z.number().min(0).optional(),
  national_avg_fab_rate: z.number().min(0).optional(),
  overhead_percent: z.number().min(0).max(100).optional(),
  margin_percent: z.number().min(0).max(100).optional(),
});

export async function GET(
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

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let { data: profile, error: fetchError } = await supabase
    .from('pricing_profiles')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!profile) {
    const { data: inserted, error: insertError } = await supabase
      .from('pricing_profiles')
      .insert({
        project_id: projectId,
        ...DEFAULT_PROFILE,
        fitting_prices: {},
        device_prices: {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    profile = inserted;
  }

  return NextResponse.json(profile);
}

export async function PATCH(
  request: Request,
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

  let { data: profile } = await supabase
    .from('pricing_profiles')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (!profile) {
    const { data: inserted, error: insertError } = await supabase
      .from('pricing_profiles')
      .insert({
        project_id: projectId,
        ...DEFAULT_PROFILE,
        fitting_prices: {},
        device_prices: {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    profile = inserted;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.rect_duct_price_per_lb !== undefined) update.rect_duct_price_per_lb = parsed.data.rect_duct_price_per_lb;
  if (parsed.data.round_duct_prices !== undefined) update.round_duct_prices = parsed.data.round_duct_prices;
  if (parsed.data.labor_rate_per_hour !== undefined) update.labor_rate_per_hour = parsed.data.labor_rate_per_hour;
  if (parsed.data.national_avg_install_rate !== undefined) update.national_avg_install_rate = parsed.data.national_avg_install_rate;
  if (parsed.data.national_avg_fab_rate !== undefined) update.national_avg_fab_rate = parsed.data.national_avg_fab_rate;
  if (parsed.data.overhead_percent !== undefined) update.overhead_percent = parsed.data.overhead_percent;
  if (parsed.data.margin_percent !== undefined) update.margin_percent = parsed.data.margin_percent;

  if (Object.keys(update).length === 0) {
    const { data: current } = await supabase
      .from('pricing_profiles')
      .select('*')
      .eq('id', profile.id)
      .single();
    return NextResponse.json(current ?? profile);
  }

  const { data: updated, error } = await supabase
    .from('pricing_profiles')
    .update(update)
    .eq('id', profile.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
