import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route';
import { uploadPDF, uploadSheetImage, getSheetImageForAnalysis } from '@/lib/storage';
import { renderPdfPageToPng, getPdfPageCount } from '@/lib/pdf-to-image';
import { runClassifier } from '@/agents/classifier';
import { runNotesExtractor } from '@/agents/notes-extractor';
import { mergeSpecContext } from '@/lib/spec-context';

export async function POST(
  _request: Request,
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
  const { data: project, error: projectError } = await supabaseAuth
    .from('projects')
    .select('id, default_scale, spec_context')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? 'Project not found' },
      { status: 404 }
    );
  }

  const formData = await _request.formData();
  const file = formData.get('file') as File | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file provided. Use form field "file"' },
      { status: 400 }
    );
  }

  const contentType = file.type;
  if (contentType !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are allowed' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || 'upload.pdf';

  try {
    await supabaseAuth
      .from('projects')
      .update({ status: 'analyzing' })
      .eq('id', projectId);

    // 1. Upload PDF to storage
    const pdfPath = await uploadPDF(projectId, buffer, filename);

    // 2. Convert pages to images and create sheets
    const pageCount = await getPdfPageCount(buffer);

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pngBuffer = await renderPdfPageToPng(buffer, pageNum);

      // Create sheet record first to get ID for image path
      const { data: sheet, error: insertError } = await supabaseAuth
        .from('sheets')
        .insert({
          project_id: projectId,
          filename,
          page_num: pageNum,
          pdf_path: pdfPath,
          image_path: null,
        })
        .select('id')
        .single();

      if (insertError || !sheet) {
        throw new Error(
          `Failed to create sheet for page ${pageNum}: ${insertError?.message}`
        );
      }

      // Upload sheet image
      const imagePath = await uploadSheetImage(
        projectId,
        sheet.id,
        pngBuffer,
        'image/png'
      );

      // Update sheet with image path
      await supabaseAuth
        .from('sheets')
        .update({ image_path: imagePath })
        .eq('id', sheet.id);
    }

    // Phase 1: Classify new sheets; extract notes from REFERENCE sheets
    const { data: newSheets } = await supabaseAuth
      .from('sheets')
      .select('id, image_path, analysis_region')
      .eq('project_id', projectId)
      .eq('filename', filename)
      .order('page_num');
    const newSheetList = newSheets ?? [];

    const specExtractions: Awaited<ReturnType<typeof runNotesExtractor>>[] = [];
    const existingSpec = (project.spec_context as { scale_notations?: unknown[]; abbreviations?: Record<string, string>; material_conventions?: string[]; general_specs?: string[] } | null) ?? null;

    for (const s of newSheetList) {
      if (!s.image_path) continue;
      try {
        await supabaseAuth
          .from('sheets')
          .update({ analysis_status: 'processing' })
          .eq('id', s.id);

        const imageUrl = await getSheetImageForAnalysis(s.image_path, s.analysis_region);
        const classifier = await runClassifier({ imageBase64: imageUrl });
        await supabaseAuth
          .from('sheets')
          .update({
            sheet_number: classifier.sheet_number,
            sheet_title: classifier.sheet_title,
            sheet_types: classifier.sheet_types,
            analysis_status: 'pending',
          })
          .eq('id', s.id);

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
        // Classifier failed for this sheet; continue
      }
    }

    // Merge with existing spec_context and save
    if (specExtractions.length > 0) {
      const existing = existingSpec ? [existingSpec] : [];
      const merged = mergeSpecContext([...existing, ...specExtractions]);
      const hasSpec =
        merged.scale_notations?.length ||
        (merged.abbreviations && Object.keys(merged.abbreviations).length) ||
        merged.material_conventions?.length ||
        merged.general_specs?.length ||
        (merged.symbol_legend && Object.keys(merged.symbol_legend).length);
      if (hasSpec) {
        await supabaseAuth
          .from('projects')
          .update({ spec_context: merged })
          .eq('id', projectId);
      }
    }

    await supabaseAuth
      .from('projects')
      .update({ status: 'draft' })
      .eq('id', projectId);

    // Fetch created sheets
    const { data: sheets } = await supabaseAuth
      .from('sheets')
      .select('*')
      .eq('project_id', projectId)
      .eq('filename', filename)
      .order('page_num');

    return NextResponse.json({
      pdf_path: pdfPath,
      page_count: pageCount,
      sheets: sheets ?? [],
    });
  } catch (err) {
    await supabaseAuth
      .from('projects')
      .update({ status: 'draft' })
      .eq('id', projectId);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
