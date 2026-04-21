import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { AI_CALL_TIMEOUT_MS } from '@/lib/ai-timeouts';
import { VALIDATOR_SYSTEM_PROMPT } from './prompts/validator';
import {
  validatorOutputSchema,
  type ValidatorOutput,
} from './schemas';
import type { ReconciledComponent } from './schemas';
import type { ScheduleOutput } from './schemas';

export type ValidatorInput = {
  components: ReconciledComponent[];
  schedule: ScheduleOutput | null;
  sheetTypes: string[];
};

/**
 * Cross-validates components against schedule and sheet types
 */
export async function runValidator(input: ValidatorInput): Promise<ValidatorOutput> {
  const context = JSON.stringify(
    {
      components: input.components,
      schedule: input.schedule,
      sheetTypes: input.sheetTypes,
    },
    null,
    2
  );

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: validatorOutputSchema,
    system: VALIDATOR_SYSTEM_PROMPT,
    abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS.validator),
    prompt: `Validate this HVAC takeoff data:\n\n${context}`,
  });

  return object;
}
