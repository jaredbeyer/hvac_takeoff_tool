import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { QA_AUDIT_SYSTEM_PROMPT } from './prompts/qa-audit';
import {
  qaAuditOutputSchema,
  type QaAuditOutput,
} from './schemas';
import type { ReconciledComponent } from './schemas';

export type QaAuditorInput = {
  components: ReconciledComponent[];
  scheduleEquipment: Array<{ tag: string; description: string }>;
};

/**
 * Independent QA review by Gemini (different model family for unbiased audit)
 */
export async function runQaAuditor(input: QaAuditorInput): Promise<QaAuditOutput> {
  const context = JSON.stringify(
    {
      components: input.components,
      scheduleEquipment: input.scheduleEquipment,
    },
    null,
    2
  );

  const { object } = await generateObject({
    model: google('gemini-2.5-pro'),
    schema: qaAuditOutputSchema,
    system: QA_AUDIT_SYSTEM_PROMPT,
    prompt: `Audit this HVAC takeoff BOM:\n\n${context}`,
  });

  return object;
}
