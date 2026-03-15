-- ============================================
-- Velocity Takeoff Engine — Storage Buckets
-- Create buckets for PDF and sheet image storage
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('project-pdfs', 'project-pdfs', false),
  ('sheet-images', 'sheet-images', false)
ON CONFLICT (id) DO NOTHING;
