import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { RECONCILIATION_SYSTEM_PROMPT } from './prompts/reconciliation';
import {
  reconciliationOutputSchema,
  type ReconciliationOutput,
} from './schemas';
import type { ComponentExtractionOutput } from './schemas';

export type ReconciliationInput = {
  claudeExtraction: ComponentExtractionOutput;
  gpt4oExtraction: ComponentExtractionOutput;
};

/**
 * Merges dual extractions from Claude and GPT-4o, assigns confidence and source
 */
export async function runReconciliation(
  input: ReconciliationInput
): Promise<ReconciliationOutput> {
  const context = JSON.stringify(
    {
      claude: input.claudeExtraction,
      gpt4o: input.gpt4oExtraction,
    },
    null,
    2
  );

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-6'),
    schema: reconciliationOutputSchema,
    system: RECONCILIATION_SYSTEM_PROMPT,
    prompt: `Merge these two extractions into one reconciled list:\n\n${context}`,
  });

  return object;
}
