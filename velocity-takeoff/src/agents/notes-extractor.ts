import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { specExtractionOutputSchema, type SpecExtractionOutput } from './schemas';

const MODEL = anthropic('claude-sonnet-4-6');

export type NotesExtractorInput = {
  imageBase64: string;
};

/**
 * Extracts project-level context from REFERENCE sheets (cover, notes, abbreviations, symbols).
 * Results are merged into project.spec_context before takeoff.
 */
export async function runNotesExtractor(
  input: NotesExtractorInput
): Promise<SpecExtractionOutput> {
  // #region agent log
  console.log(
    JSON.stringify({
      agentlog: true,
      sessionId: '48a744',
      runId: 'prod-debug',
      hypothesisId: 'H7',
      location: 'agents/notes-extractor.ts:runNotesExtractor:start',
      message: 'notes-extractor start',
      data: {
        anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
        imageChars: input.imageBase64?.length ?? null,
      },
      timestamp: Date.now(),
    })
  );
  // #endregion agent log

  const { object } = await generateObject({
    model: MODEL,
    schema: specExtractionOutputSchema,
    system: NOTES_EXTRACTOR_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract scale notations, abbreviations, material conventions, and general specs from this reference/notes sheet. Use this to inform takeoff on other sheets.',
          },
          {
            type: 'image',
            image: input.imageBase64,
            mediaType: 'image/png',
          },
        ],
      },
    ],
  });

  return object;
}

const NOTES_EXTRACTOR_SYSTEM_PROMPT = `You are an expert at reading mechanical/HVAC construction drawing reference sheets.

Your task: Extract structured context that will help takeoff agents interpret plan and detail sheets correctly.

## Extract (return null for any category not present)

1. **scale_notations**: Array of scale strings found (e.g. "1/4\\" = 1'-0\\"", "NTS"). Different sheets may use different scales.

2. **abbreviations**: Object mapping abbreviation -> full meaning. Examples:
   - LF = linear feet
   - GALV = galvanized
   - SS = stainless steel
   - EA = each
   - NTS = not to scale
   - Include any HVAC/sheet-specific abbreviations from the legend

3. **material_conventions**: Array of material specifications (e.g. "Ductwork: galvanized unless noted", "22 ga minimum for sizes 24\" and below")

4. **general_specs**: Array of relevant spec snippets (gauge requirements, insulation notes, hanger spacing, etc.)

5. **symbol_legend**: Object mapping component name -> symbol description. Extract from the symbols legend/plan key. Examples:
   - "flex duct" or "flexible duct" -> how it's drawn (e.g. "wavy/dashed line", "double line with hatch")
   - "diffuser" -> symbol shape
   - "grille" -> symbol shape
   - "register" -> symbol shape
   - "round duct" -> single line or double line
   - "rectangular duct" -> how shown on plan
   - Include any symbol definitions that help identify duct types and air devices on plans

## Rules
- Be conservative: only extract what is clearly visible and relevant to HVAC takeoff
- Normalize abbreviations to uppercase keys
- If the sheet is mostly blank or not a reference/notes sheet, return nulls/empty arrays`;