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
  // #region agent log
  console.log(
    JSON.stringify({
      agentlog: true,
      sessionId: '48a744',
      runId: 'prod-debug',
      hypothesisId: 'H5',
      location: 'agents/schedule-reader.ts:runScheduleReader:start',
      message: 'schedule-reader start',
      data: {
        geminiKeyPresent: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        imageChars: input.imageBase64?.length ?? null,
      },
      timestamp: Date.now(),
    })
  );
  // #endregion agent log

  try {
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

    // #region agent log
    console.log(
      JSON.stringify({
        agentlog: true,
        sessionId: '48a744',
        runId: 'prod-debug',
        hypothesisId: 'H5',
        location: 'agents/schedule-reader.ts:runScheduleReader:success',
        message: 'schedule-reader success',
        data: { equipmentCount: object?.equipment?.length ?? null },
        timestamp: Date.now(),
      })
    );
    // #endregion agent log

    return object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // #region agent log
    console.error(
      JSON.stringify({
        agentlog: true,
        sessionId: '48a744',
        runId: 'prod-debug',
        hypothesisId: 'H5',
        location: 'agents/schedule-reader.ts:runScheduleReader:error',
        message: 'schedule-reader error',
        data: {
          errorMessage: msg,
          errorName: err instanceof Error ? err.name : null,
          geminiKeyPresent: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        },
        timestamp: Date.now(),
      })
    );
    // #endregion agent log
    throw err;
  }
}
