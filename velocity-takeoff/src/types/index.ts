// ============================================
// Velocity Takeoff Engine — TypeScript Types
// Matches database schema in 001_initial_schema.sql
// ============================================

export type ProjectStatus = 'draft' | 'analyzing' | 'reviewed' | 'bid_sent';
export type SheetAnalysisStatus = 'pending' | 'queued' | 'processing' | 'complete' | 'error';
export type ComponentType =
  | 'rectangular_duct'
  | 'round_duct'
  | 'flex_duct'
  | 'fitting'
  | 'air_device'
  | 'equipment'
  | 'pipe'
  | 'insulation'
  | 'accessory';
export type LineItemUnit = 'EA' | 'LF' | 'SF' | 'LBS';
export type TakeoffScope = 'ductwork' | 'devices_equipment' | 'everything';
export type Confidence = 'high' | 'medium' | 'low';
export type LineItemSource = 'both_models' | 'claude_only' | 'gpt4o_only' | 'manual';
export type SystemType = 'supply' | 'return' | 'exhaust' | 'outside_air' | 'mixed';

export interface Project {
  id: string;
  name: string;
  client: string | null;
  bid_date: string | null; // ISO date
  status: ProjectStatus;
  default_scale: string;
  scale_ratio: number;
  takeoff_scope: TakeoffScope;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sheet {
  id: string;
  project_id: string;
  filename: string;
  page_num: number;
  sheet_number: string | null;
  sheet_title: string | null;
  sheet_types: string[];
  scale_override: string | null;
  image_path: string | null;
  pdf_path: string | null;
  analysis_status: SheetAnalysisStatus;
  analysis_error: string | null;
  analysis_error_source: string | null;
  analysis_region: AnalysisRegion | null;
  created_at: string;
}

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineItem {
  id: string;
  sheet_id: string;
  system_tag: string;
  component_type: ComponentType;
  description: string;
  size: string | null;
  quantity: number;
  unit: LineItemUnit;
  linear_feet: number | null;
  lbs: number | null;
  bbox: Bbox | null;
  gauge: string | null;
  material: string | null;
  confidence: Confidence;
  source: LineItemSource;
  needs_review: boolean;
  human_verified: boolean;
  reconciliation_notes: string | null;
  unit_price: number | null;
  extended_price: number | null;
  install_labor_hrs: number | null;
  fab_labor_hrs: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface System {
  id: string;
  project_id: string;
  system_tag: string;
  system_type: SystemType;
  description: string | null;
}

export interface PricingProfile {
  id: string;
  project_id: string;
  rect_duct_price_per_lb: number;
  round_duct_prices: Record<string, number>;
  fitting_prices: Record<string, number>;
  device_prices: Record<string, number>;
  labor_rate_per_hour: number;
  national_avg_install_rate?: number;
  national_avg_fab_rate?: number;
  overhead_percent: number;
  margin_percent: number;
}

export interface Bid {
  id: string;
  project_id: string;
  version: number;
  material_total: number;
  labor_total: number;
  overhead: number;
  margin: number;
  bid_total: number;
  export_path: string | null;
  created_at: string;
}
