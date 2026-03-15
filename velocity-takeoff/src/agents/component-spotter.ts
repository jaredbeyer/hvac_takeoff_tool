import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { getComponentExtractionPrompt } from './prompts/component';
import {
  componentExtractionOutputSchema,
  type ComponentExtractionOutput,
} from './schemas';

const MODEL_CLAUDE = anthropic('claude-opus-4-6');
const MODEL_GPT4O = openai('gpt-4o');

export type TakeoffScope = 'ductwork' | 'devices_equipment' | 'everything';

export type SpecContext = {
  scale_notations?: string[] | null;
  abbreviations?: Record<string, string> | null;
  material_conventions?: string[] | null;
  general_specs?: string[] | null;
  symbol_legend?: Record<string, string> | null;
};

export type ScheduleEquipmentItem = {
  tag: string;
  type: string;
  description: string;
  size_capacity?: string | null;
  neck_size?: string | null;
  size?: string | null;
  location?: string | null;
  manufacturer_model?: string | null;
  notes?: string | null;
};

export type ComponentSpotterInput = {
  imageBase64: string;
  takeoffScope?: TakeoffScope;
  specContext?: SpecContext | null;
  scheduleContext?: { equipment: ScheduleEquipmentItem[] } | null;
};

export type ComponentSpotterResult = {
  claude: ComponentExtractionOutput;
  gpt4o: ComponentExtractionOutput;
};

/**
 * Runs Claude Opus and GPT-4o in parallel for component extraction.
 * Returns both extractions for reconciliation.
 */
export async function runComponentSpotter(
  input: ComponentSpotterInput
): Promise<ComponentSpotterResult> {
  const userContent = [
    {
      type: 'text' as const,
      text: 'Extract all HVAC components from this mechanical plan. Return a components array.',
    },
    {
      type: 'image' as const,
      image: input.imageBase64,
      mediaType: 'image/png' as const,
    },
  ];

  const scope = input.takeoffScope ?? 'everything';
  const systemPrompt = getComponentExtractionPrompt(
    scope,
    input.specContext,
    input.scheduleContext
  );

  const [claudeSettled, gpt4oSettled] = await Promise.allSettled([
    generateObject({
      model: MODEL_CLAUDE,
      schema: componentExtractionOutputSchema,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userContent }],
      maxTokens: 8192,
    }),
    generateObject({
      model: MODEL_GPT4O,
      schema: componentExtractionOutputSchema,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userContent }],
      maxTokens: 8192,
    }),
  ]);

  const claude = claudeSettled.status === 'fulfilled' ? claudeSettled.value.object : null;
  const gpt4o = gpt4oSettled.status === 'fulfilled' ? gpt4oSettled.value.object : null;

  if (!claude) throw claudeSettled.reason;
  const fallback = claude;
  return {
    claude,
    gpt4o: gpt4o ?? fallback, // Use Claude as fallback when GPT-4o fails (Invalid JSON, etc.)
  };
}
