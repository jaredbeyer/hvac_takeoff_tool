import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { getSheetImageForAnalysis } from '@/lib/storage';
import { runClassifier } from '@/agents/classifier';
import { runNotesExtractor } from '@/agents/notes-extractor';
import { mergeSpecContext } from '@/lib/spec-context';

/**
 * Phase 1: Classify all sheets and extract spec context from REFERENCE sheets.
 * Use for existing projects that need classification (e.g. before Phase 2 takeoff).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let sheetIdsFilter: string[] | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.sheetIds) && body.sheetIds.length > 0) {
      sheetIdsFilter = body.sheetIds;
    }
  } catch {
    // No body – classify all sheets
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
    .select('id, spec_context')
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
    .select('id, image_path, analysis_region')
    .eq('project_id', projectId)
    .not('image_path', 'is', null)
    .order('page_num');

  if (sheetIdsFilter?.length) {
    query = query.in('id', sheetIdsFilter);
  }

  const { data: sheets, error: sheetsError } = await query;

  if (sheetsError || !sheets?.length) {
    return NextResponse.json(
      { error: sheetsError?.message ?? 'No sheets with images' },
      { status: 400 }
    );
  }

  const existingSpec = (project.spec_context ?? null) as Parameters<
    typeof mergeSpecContext
  >[0][0];
  const specExtractions: Awaited<ReturnType<typeof runNotesExtractor>>[] = [];

  for (const sheet of sheets) {
    try {
      const imageUrl = await getSheetImageForAnalysis(
        sheet.image_path!,
        sheet.analysis_region
      );
      const classifier = await runClassifier({ imageBase64: imageUrl });
      await supabase
        .from('sheets')
        .update({
          sheet_number: classifier.sheet_number,
          sheet_title: classifier.sheet_title,
          sheet_types: classifier.sheet_types,
        })
        .eq('id', sheet.id);

      const isReference = classifier.sheet_types.some((t) =>
        ['REFERENCE', 'OTHER'].includes(t)
      );
      if (isReference) {
        try {
          const spec = await runNotesExtractor({ imageBase64: imageUrl });
          specExtractions.push(spec);
        } catch {
          // Notes extraction optional
        }
      }
    } catch {
      // Continue with other sheets
    }
  }

  const toMerge = existingSpec ? [existingSpec, ...specExtractions] : specExtractions;
  const specContext = mergeSpecContext(toMerge);
  const hasSpec =
    specContext.scale_notations?.length ||
    (specContext.abbreviations && Object.keys(specContext.abbreviations).length) ||
    specContext.material_conventions?.length ||
    specContext.general_specs?.length ||
    (specContext.symbol_legend && Object.keys(specContext.symbol_legend).length);

  if (hasSpec || toMerge.length > 0) {
    await supabase
      .from('projects')
      .update({ spec_context: specContext })
      .eq('id', projectId);
  }

  return NextResponse.json({
    project_id: projectId,
    sheets_classified: sheets.length,
    spec_context_saved: !!hasSpec,
  });
}
