import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { AI_CALL_TIMEOUT_MS } from '@/lib/ai-timeouts';
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts/classifier';
import {
  classifierOutputSchema,
  type ClassifierOutput,
} from './schemas';

const MODEL = anthropic('claude-sonnet-4-6');

export type ClassifierInput = {
  imageBase64: string;
};

/**
 * Classifies a sheet image by type (FLOOR_PLAN, EQUIPMENT_SCHEDULE, etc.)
 */
export async function runClassifier(input: ClassifierInput): Promise<ClassifierOutput> {
  // #region agent log
  console.log(
    JSON.stringify({
      agentlog: true,
      sessionId: '48a744',
      runId: 'prod-debug',
      hypothesisId: 'H6',
      location: 'agents/classifier.ts:runClassifier:start',
      message: 'classifier start',
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
    schema: classifierOutputSchema,
    system: CLASSIFIER_SYSTEM_PROMPT,
    abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS.classifier),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Classify this mechanical sheet. Extract sheet_number from the title block (e.g. M101, M-101, M-2) – use the EXACT designation printed on the drawing, never the PDF page number. Return sheet_types, sheet_number, and sheet_title.',
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
