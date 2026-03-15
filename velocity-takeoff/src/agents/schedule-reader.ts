import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { SCHEDULE_EXTRACTION_SYSTEM_PROMPT } from './prompts/schedule';
import {
  scheduleOutputSchema,
  type ScheduleOutput,
} from './schemas';

const MODEL = google('gemini-2.5-pro');

export type ScheduleReaderInput = {
  imageBase64: string;
};

/**
 * Extracts equipment data from schedule tables in a sheet image
 */
export async function runScheduleReader(input: ScheduleReaderInput): Promise<ScheduleOutput> {
  const { object } = await generateObject({
    model: MODEL,
    schema: scheduleOutputSchema,
    system: SCHEDULE_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all equipment from the schedule table(s) in this image.',
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
