-- Takeoff enhancements: linear_feet, lbs, bbox, takeoff_scope, analysis_region

-- Line items: add linear_feet, lbs, and bbox for highlighting
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS linear_feet FLOAT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS lbs FLOAT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS bbox JSONB; -- { x, y, width, height } normalized 0-1

-- Sheets: optional analysis region (user-drawn box to limit takeoff area)
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS analysis_region JSONB; -- { x, y, width, height } normalized 0-1

-- Projects: takeoff scope filter
ALTER TABLE projects ADD COLUMN IF NOT EXISTS takeoff_scope TEXT DEFAULT 'everything'
  CHECK (takeoff_scope IN ('ductwork', 'devices_equipment', 'everything'));
