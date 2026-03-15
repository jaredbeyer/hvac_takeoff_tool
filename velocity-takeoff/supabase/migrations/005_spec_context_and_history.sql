-- Project-level spec context (extracted from REFERENCE sheets before takeoff)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spec_context JSONB;

-- Historical takeoff patterns for prompt enrichment (per-user)
-- Stores common component patterns from human-verified line items
CREATE TABLE IF NOT EXISTS takeoff_patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  component_type   TEXT NOT NULL,
  size             TEXT,
  material         TEXT,
  gauge            TEXT,
  description_pattern TEXT,
  frequency        INT NOT NULL DEFAULT 1,
  last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_patterns_user ON takeoff_patterns(created_by);
CREATE INDEX IF NOT EXISTS idx_takeoff_patterns_type ON takeoff_patterns(component_type);

ALTER TABLE takeoff_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own takeoff patterns"
  ON takeoff_patterns FOR ALL
  USING (created_by = auth.uid());
