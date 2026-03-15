import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { getMeasurementSystemPrompt } from './prompts/measurement';
import {
  componentExtractionOutputSchema,
  type ComponentExtractionOutput,
} from './schemas';

const MODEL = anthropic('claude-opus-4-6');

import type { SpecContext, ScheduleContext } from './prompts/component';

export type MeasurementInput = {
  imageBase64: string;
  scaleStr: string;
  scaleRatio: number;
  pixelsPerFoot: number;
  sheetNumber?: string | null;
  specContext?: SpecContext | null;
  scheduleContext?: ScheduleContext | null;
};

/**
 * Measures ductwork and components using the provided drawing scale.
 * Scale is user-provided; AI does NOT detect scale.
 */
export async function runMeasurement(input: MeasurementInput): Promise<ComponentExtractionOutput> {
  const systemPrompt = getMeasurementSystemPrompt({
    scaleStr: input.scaleStr,
    scaleRatio: input.scaleRatio,
    pixelsPerFoot: input.pixelsPerFoot,
    sheetNumber: input.sheetNumber,
    specContext: input.specContext,
    scheduleContext: input.scheduleContext,
  });

  const { object } = await generateObject({
    model: MODEL,
    schema: componentExtractionOutputSchema,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Measure all HVAC components in this image using the scale provided in the system prompt.',
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
