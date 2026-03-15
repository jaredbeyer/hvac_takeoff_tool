-- Add column to identify which AI agent/step failed
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS analysis_error_source TEXT;
