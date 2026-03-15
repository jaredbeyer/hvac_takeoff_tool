import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { getSheetImageForAnalysis } from '@/lib/storage';
import { calculatePixelsPerFoot } from '@/lib/scale';
import { runSheetPipeline, getErrorSource } from '@/agents/orchestrator';
import { runScheduleReader } from '@/agents/schedule-reader';
import type { ScheduleOutput } from '@/agents/schemas';
import { serializeError } from '@/lib/errors';
import { computeSheetMetalLbs } from '@/lib/duct-calc';
import { computeLaborHrs } from '@/lib/labor';

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let sheetIdsFilter: string[] | null = null;
  try {
    const body = await request.json();
    if (Array.isArray(body?.sheetIds) && body.sheetIds.length > 0) {
      sheetIdsFilter = body.sheetIds;
    }
  } catch {
    // No body or invalid JSON – process all sheets
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, default_scale, scale_ratio, takeoff_scope, spec_context')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  let query = supabase
    .from('sheets')
    .select('id, image_path, scale_override, sheet_number, sheet_title, sheet_types, analysis_region')
    .eq('project_id', projectId)
    .not('image_path', 'is', null)
    .order('page_num');

  if (sheetIdsFilter?.length) {
    query = query.in('id', sheetIdsFilter);
  }

  const { data: sheets, error: sheetsError } = await query;

  if (sheetsError || !sheets?.length) {
    return NextResponse.json(
      { error: sheetsError?.message ?? 'No sheets with images to analyze' },
      { status: 400 }
    );
  }

  const scaleStr = project.default_scale;
  const scaleRatio = project.scale_ratio;
  const pixelsPerFoot = calculatePixelsPerFoot(scaleRatio, 96);
  const takeoffScope = (project.takeoff_scope ?? 'everything') as
    | 'ductwork'
    | 'devices_equipment'
    | 'everything';

  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'analyzing' })
    .eq('id', projectId);

  const results: Array<{
    sheetId: string;
    status: 'complete' | 'error';
    error?: string;
    errorSource?: string;
    lineItemsCount?: number;
  }> = [];

  // Mark all sheets as queued first (process in order, one at a time).
  // If migration 007 not applied, 'queued' violates constraint—fall back to processing without queue state.
  const { error: queueError } = await supabase
    .from('sheets')
    .update({ analysis_status: 'queued', analysis_error: null })
    .in('id', sheets.map((s) => s.id));

  const queueSupported = !queueError;
  if (queueError?.message?.includes('check constraint')) {
    // Migration 007 not applied; skip status-based skip check so we process all sheets
  }

  const specContext = (project.spec_context ?? null) as {
    scale_notations?: string[] | null;
    abbreviations?: Record<string, string> | null;
    material_conventions?: string[] | null;
    general_specs?: string[] | null;
    symbol_legend?: Record<string, string> | null;
  } | null;
  const hasSpecContext =
    specContext &&
    (specContext.scale_notations?.length ||
      (specContext.abbreviations && Object.keys(specContext.abbreviations).length) ||
      specContext.material_conventions?.length ||
      specContext.general_specs?.length ||
      (specContext.symbol_legend && Object.keys(specContext.symbol_legend).length));

  // Pre-pass: Aggregate schedules from EQUIPMENT_SCHEDULE sheets (for use on plan sheets)
  const scheduleSheets = sheets.filter((s) =>
    (s.sheet_types ?? []).includes('EQUIPMENT_SCHEDULE')
  );
  const aggregatedSchedule: ScheduleOutput = { equipment: [] };
  const tagToEquipment = new Map<string, { tag: string; type: string; description: string; size_capacity?: string | null; neck_size?: string | null; size?: string | null; location?: string | null; manufacturer_model?: string | null; notes?: string | null }>();
  for (const s of scheduleSheets) {
    try {
      const imageUrl = await getSheetImageForAnalysis(s.image_path!, s.analysis_region);
      const schedule = await runScheduleReader({ imageBase64: imageUrl });
      for (const eq of schedule.equipment ?? []) {
        if (eq.tag && !tagToEquipment.has(eq.tag)) {
          tagToEquipment.set(eq.tag, eq);
          aggregatedSchedule.equipment.push(eq);
        }
      }
    } catch {
      // Continue with other sheets
    }
  }
  const hasSchedule = aggregatedSchedule.equipment.length > 0;

  // Phase 2: Takeoff on FLOOR_PLAN, DETAIL, EQUIPMENT_SCHEDULE
  for (const sheet of sheets) {
    const { data: currentSheet } = await supabase
      .from('sheets')
      .select('analysis_status')
      .eq('id', sheet.id)
      .single();
    const willSkip = queueSupported && (currentSheet?.analysis_status !== 'queued' && currentSheet?.analysis_status !== 'processing');
    if (willSkip) {
      continue;
    }
    const sheetScaleStr = sheet.scale_override ?? scaleStr;
    let sheetScaleRatio = scaleRatio;
    if (sheet.scale_override) {
      try {
        const { parseScale } = await import('@/lib/scale');
        sheetScaleRatio = parseScale(sheet.scale_override);
      } catch {
        // Fall back to project scale
      }
    }
    const sheetPixelsPerFoot = calculatePixelsPerFoot(sheetScaleRatio, 96);

    try {
      await supabase
        .from('sheets')
        .update({ analysis_status: 'processing', analysis_error: null })
        .eq('id', sheet.id);

      // Clear existing line items for this sheet so we reprocess as fresh takeoff
      await supabase.from('line_items').delete().eq('sheet_id', sheet.id);

      const imageUrl = await getSheetImageForAnalysis(
        sheet.image_path!,
        sheet.analysis_region
      );

      const preClassified =
        sheet.sheet_types?.length || sheet.sheet_number || sheet.sheet_title
          ? {
              sheet_types: sheet.sheet_types ?? [],
              sheet_number: sheet.sheet_number ?? null,
              sheet_title: sheet.sheet_title ?? null,
            }
          : undefined;

      const hasTakeoff =
        preClassified?.sheet_types.some((t: string) =>
          ['FLOOR_PLAN', 'DETAIL', 'EQUIPMENT_SCHEDULE'].includes(t)
        ) ?? true;

      let pipelineResult: Awaited<ReturnType<typeof runSheetPipeline>>;
      if (hasTakeoff) {
        pipelineResult = await runSheetPipeline({
          sheetId: sheet.id,
          imageBase64: imageUrl,
          scaleStr: sheetScaleStr,
          scaleRatio: sheetScaleRatio,
          pixelsPerFoot: sheetPixelsPerFoot,
          sheetNumber: sheet.sheet_number,
          takeoffScope,
          specContext: hasSpecContext ? specContext : null,
          scheduleContext: hasSchedule ? aggregatedSchedule : null,
          preClassified: preClassified ?? undefined,
        });
      } else {
        pipelineResult = {
          classifier: preClassified ?? {
            sheet_types: [],
            sheet_number: null,
            sheet_title: null,
          },
          schedule: null,
          componentSpotter: null,
          reconciliation: null,
          measurement: null,
          validator: null,
          qaAudit: null,
        };
      }

      // Update sheet status (classifier data already from Phase 1)
      const classifierSheetNumber = pipelineResult.classifier.sheet_number;
      await supabase
        .from('sheets')
        .update({
          analysis_status: 'complete',
          analysis_error: null,
          sheet_number: classifierSheetNumber ?? sheet.sheet_number,
          sheet_title: pipelineResult.classifier.sheet_title ?? sheet.sheet_title,
          sheet_types: pipelineResult.classifier.sheet_types?.length
            ? pipelineResult.classifier.sheet_types
            : sheet.sheet_types ?? [],
        })
        .eq('id', sheet.id);

      // Insert line items from reconciliation
      const components = pipelineResult.reconciliation?.components ?? [];
      let lineItemsCount = 0;

      for (const comp of components) {
        const lf =
          comp.linear_feet ?? (comp.unit === 'LF' ? comp.quantity : null);
        const lbs =
          comp.lbs ??
          computeSheetMetalLbs(
            comp.component_type,
            comp.size,
            lf,
            comp.quantity ?? 0,
            comp.gauge ?? null
          );
        const bbox =
          comp.bbox && typeof comp.bbox === 'object'
            ? comp.bbox
            : null;

        const labor = computeLaborHrs(
          comp.component_type,
          comp.size,
          comp.quantity ?? 0,
          comp.unit,
          lf,
          lbs ?? null,
          comp.gauge ?? null,
          comp.description ?? null
        );

        const { error: insertError } = await supabase.from('line_items').insert({
          sheet_id: sheet.id,
          system_tag: comp.system_tag,
          component_type: comp.component_type,
          description: comp.description,
          size: comp.size,
          quantity: comp.quantity,
          unit: comp.unit,
          linear_feet: lf,
          lbs,
          bbox,
          gauge: comp.gauge,
          material: comp.material,
          confidence: comp.confidence,
          source: comp.source,
          needs_review: comp.needs_review,
          reconciliation_notes: comp.reconciliation_notes,
          install_labor_hrs: labor?.installHrs ?? null,
          fab_labor_hrs: labor?.fabHrs ?? null,
        });
        if (!insertError) lineItemsCount++;
      }

      results.push({ sheetId: sheet.id, status: 'complete', lineItemsCount });
    } catch (err) {
      const fullError = serializeError(err);
      const errorSource = getErrorSource(err);
      await supabase
        .from('sheets')
        .update({
          analysis_status: 'error',
          analysis_error: fullError,
          analysis_error_source: errorSource,
        })
        .eq('id', sheet.id);
      results.push({
        sheetId: sheet.id,
        status: 'error',
        error: fullError,
        errorSource: errorSource ?? undefined,
      });
    }
  }

  await supabase
    .from('projects')
    .update({ status: 'draft' })
    .eq('id', projectId);

  return NextResponse.json({
    project_id: projectId,
    sheets_processed: results.length,
    results,
  });
}
