-- National average install and fab labor for each line item

-- Line items: store computed labor hours (nullable for legacy items; computed on insert/display)
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS install_labor_hrs FLOAT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS fab_labor_hrs FLOAT;

-- Pricing profiles: national average labor rates ($/hr) for install and fab
ALTER TABLE pricing_profiles ADD COLUMN IF NOT EXISTS national_avg_install_rate FLOAT DEFAULT 55;
ALTER TABLE pricing_profiles ADD COLUMN IF NOT EXISTS national_avg_fab_rate FLOAT DEFAULT 48;
