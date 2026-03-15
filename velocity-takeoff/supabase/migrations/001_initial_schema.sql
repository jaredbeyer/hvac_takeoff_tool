-- ============================================
-- Velocity Takeoff Engine — Database Schema
-- Runs on Supabase PostgreSQL
-- ============================================

-- -------------------------------------------
-- PROJECTS
-- -------------------------------------------
CREATE TABLE projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  client         TEXT,
  bid_date       DATE,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'analyzing', 'reviewed', 'bid_sent')),
  default_scale  TEXT NOT NULL,             -- e.g., '1/4" = 1''-0"'
  scale_ratio    FLOAT NOT NULL,            -- computed numeric ratio
  created_by     UUID NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------
-- SHEETS (one per PDF page)
-- -------------------------------------------
CREATE TABLE sheets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  page_num         INT NOT NULL,
  sheet_number     TEXT,                    -- e.g., 'M-101'
  sheet_title      TEXT,
  sheet_types      TEXT[] DEFAULT '{}',     -- ['FLOOR_PLAN', 'EQUIPMENT_SCHEDULE']
  scale_override   TEXT,                    -- if different from project default
  image_path       TEXT,                    -- Supabase Storage path
  pdf_path         TEXT,                    -- Supabase Storage path
  analysis_status  TEXT NOT NULL DEFAULT 'pending'
                     CHECK (analysis_status IN ('pending', 'processing', 'complete', 'error')),
  analysis_error   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sheets_project ON sheets(project_id);

-- -------------------------------------------
-- LINE ITEMS (individual BOM entries)
-- -------------------------------------------
CREATE TABLE line_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id              UUID NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  system_tag            TEXT NOT NULL,       -- e.g., 'AHU-1'
  component_type        TEXT NOT NULL
    CHECK (component_type IN (
      'rectangular_duct', 'round_duct', 'flex_duct', 'fitting',
      'air_device', 'equipment', 'pipe', 'insulation', 'accessory'
    )),
  description           TEXT NOT NULL,
  size                  TEXT,                -- e.g., '24x12', '14" round'
  quantity              FLOAT NOT NULL,
  unit                  TEXT NOT NULL CHECK (unit IN ('EA', 'LF', 'SF', 'LBS')),
  gauge                 TEXT,                -- e.g., '22ga'
  material              TEXT,
  confidence            TEXT NOT NULL DEFAULT 'medium'
                          CHECK (confidence IN ('high', 'medium', 'low')),
  source                TEXT NOT NULL DEFAULT 'ai'
                          CHECK (source IN ('both_models', 'claude_only', 'gpt4o_only', 'manual')),
  needs_review          BOOLEAN NOT NULL DEFAULT false,
  human_verified        BOOLEAN NOT NULL DEFAULT false,
  reconciliation_notes  TEXT,
  unit_price            FLOAT,
  extended_price        FLOAT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_line_items_sheet ON line_items(sheet_id);
CREATE INDEX idx_line_items_system ON line_items(system_tag);

-- -------------------------------------------
-- SYSTEMS (logical grouping)
-- -------------------------------------------
CREATE TABLE systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  system_tag  TEXT NOT NULL,
  system_type TEXT NOT NULL CHECK (system_type IN ('supply', 'return', 'exhaust', 'outside_air', 'mixed')),
  description TEXT,
  UNIQUE (project_id, system_tag)
);

-- -------------------------------------------
-- PRICING PROFILES
-- -------------------------------------------
CREATE TABLE pricing_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rect_duct_price_per_lb   FLOAT NOT NULL DEFAULT 0,
  round_duct_prices        JSONB NOT NULL DEFAULT '{}',   -- { "6": 3.50, "8": 4.25 }
  fitting_prices           JSONB NOT NULL DEFAULT '{}',
  device_prices            JSONB NOT NULL DEFAULT '{}',
  labor_rate_per_hour      FLOAT NOT NULL DEFAULT 0,
  overhead_percent         FLOAT NOT NULL DEFAULT 0,
  margin_percent           FLOAT NOT NULL DEFAULT 0
);

-- -------------------------------------------
-- BIDS
-- -------------------------------------------
CREATE TABLE bids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version        INT NOT NULL DEFAULT 1,
  material_total FLOAT NOT NULL DEFAULT 0,
  labor_total    FLOAT NOT NULL DEFAULT 0,
  overhead       FLOAT NOT NULL DEFAULT 0,
  margin         FLOAT NOT NULL DEFAULT 0,
  bid_total      FLOAT NOT NULL DEFAULT 0,
  export_path    TEXT,                      -- Supabase Storage path
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bids_project ON bids(project_id);

-- -------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own projects
CREATE POLICY "Users manage own projects"
  ON projects FOR ALL
  USING (created_by = auth.uid());

-- Users can see/edit sheets for their projects
CREATE POLICY "Users manage own sheets"
  ON sheets FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Users can see/edit line items for their projects
CREATE POLICY "Users manage own line items"
  ON line_items FOR ALL
  USING (sheet_id IN (
    SELECT s.id FROM sheets s
    JOIN projects p ON s.project_id = p.id
    WHERE p.created_by = auth.uid()
  ));

-- Same pattern for systems, pricing, bids
CREATE POLICY "Users manage own systems"
  ON systems FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users manage own pricing"
  ON pricing_profiles FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users manage own bids"
  ON bids FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- -------------------------------------------
-- REALTIME (enable for live UI updates)
-- -------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE line_items;

-- -------------------------------------------
-- AUTO-UPDATE updated_at TRIGGER
-- -------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER line_items_updated_at
  BEFORE UPDATE ON line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();