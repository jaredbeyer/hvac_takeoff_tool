/**
 * Per-call ceilings for vision LLM requests. If a provider hangs, we fail
 * with AbortError inside the route's try/catch so sheets are marked error
 * instead of staying "processing" after a platform 504 hard-kills the lambda.
 */
export const AI_CALL_TIMEOUT_MS = {
  classifier: 90_000,
  scheduleReader: 90_000,
  notesExtractor: 90_000,
  componentSpotter: 180_000,
  measurement: 180_000,
  reconciliation: 120_000,
  validator: 90_000,
  qaAuditor: 90_000,
} as const;
