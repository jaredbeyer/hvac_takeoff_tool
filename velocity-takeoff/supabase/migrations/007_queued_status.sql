-- Add 'queued' to sheet analysis_status for queue-based processing

ALTER TABLE sheets DROP CONSTRAINT IF EXISTS sheets_analysis_status_check;

ALTER TABLE sheets ADD CONSTRAINT sheets_analysis_status_check
  CHECK (analysis_status IN ('pending', 'queued', 'processing', 'complete', 'error'));
