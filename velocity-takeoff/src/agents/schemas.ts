/**
 * Shared Zod schemas for AI agent outputs
 * Matches database line_items and sheet structure
 */

import { z } from 'zod';

// Sheet types from database
export const sheetTypeSchema = z.enum([
  'FLOOR_PLAN',
  'EQUIPMENT_SCHEDULE',
  'DETAIL',
  'CONTROLS',
  'REFERENCE',
  'OTHER',
]);

export const componentTypeSchema = z.enum([
  'rectangular_duct',
  'round_duct',
  'flex_duct',
  'fitting',
  'air_device',
  'equipment',
  'pipe',
  'insulation',
  'accessory',
]);

export const unitSchema = z.enum(['EA', 'LF', 'SF', 'LBS']);

export const sourceSchema = z.enum([
  'both_models',
  'claude_only',
  'gpt4o_only',
  'manual',
]);

export const confidenceSchema = z.enum(['high', 'medium', 'low']);

// Coerce quantity – GPT-4o sometimes returns string
const quantitySchema = z.union([z.number(), z.string()]).transform((v) =>
  typeof v === 'string' ? parseFloat(v) || 0 : v
);

const bboxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .nullable()
  .optional();

const optionalNumSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseFloat(v) || null : v))
  .nullable()
  .optional();

// Extracted component (pre-DB, no id/sheet_id)
export const extractedComponentSchema = z.object({
  system_tag: z.string(),
  component_type: componentTypeSchema,
  description: z.string(),
  size: z.string().nullable(),
  quantity: quantitySchema,
  unit: unitSchema,
  linear_feet: optionalNumSchema,
  lbs: optionalNumSchema,
  gauge: z.string().nullable(),
  material: z.string().nullable(),
  bbox: bboxSchema,
});

// Reject "Page N" – that's a PDF page index, not a drawing designation
const sheetNumberSchema = z
  .string()
  .nullable()
  .transform((v) => {
    if (v == null || v === '') return null;
    const trimmed = v.trim();
    if (/^page\s+\d+$/i.test(trimmed)) return null;
    return trimmed;
  });

// Classifier output
export const classifierOutputSchema = z.object({
  sheet_types: z.array(sheetTypeSchema),
  sheet_number: sheetNumberSchema,
  sheet_title: z.string().nullable(),
});

// Schedule equipment item (AHU, RTU, VAV, etc. and air devices like grilles, diffusers)
export const scheduleEquipmentSchema = z.object({
  tag: z.string(),
  type: z.string(),
  description: z.string(),
  size_capacity: z.string().nullable(),
  neck_size: z.string().nullable(), // For air devices: connection/neck size (e.g. "8\"", "24x12")
  size: z.string().nullable(), // Face size, throat size, or overall size as listed
  location: z.string().nullable(),
  manufacturer_model: z.string().nullable(),
  notes: z.string().nullable(),
});

export const scheduleOutputSchema = z.object({
  equipment: z.array(scheduleEquipmentSchema),
});

// Component extraction output (array)
export const componentExtractionOutputSchema = z.object({
  components: z.array(extractedComponentSchema),
});

// Component with confidence/source (reconciliation output)
export const reconciledComponentSchema = extractedComponentSchema.extend({
  confidence: confidenceSchema,
  source: sourceSchema,
  needs_review: z.boolean(),
  reconciliation_notes: z.string().nullable(),
});

export const reconciliationOutputSchema = z.object({
  components: z.array(reconciledComponentSchema),
});

// Validator output
export const validationIssueSchema = z.object({
  field: z.string(),
  issue_type: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  suggestion: z.string().nullable(),
});

export const validatorOutputSchema = z.object({
  issues: z.array(validationIssueSchema),
  passed: z.boolean(),
  confidence: z.number(), // Avoid min/max - Anthropic rejects JSON schema minimum/maximum on number
});

// QA Audit output
export const qaIssueSchema = z.object({
  item_ref: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
  description: z.string(),
  recommendation: z.string(),
});

export const qaAuditOutputSchema = z.object({
  issues: z.array(qaIssueSchema),
  overall_score: z.enum(['pass', 'pass_with_minor_issues', 'fail']),
  summary: z.string(),
});

// Spec/notes extraction output (from REFERENCE sheets)
export const specExtractionOutputSchema = z.object({
  scale_notations: z.array(z.string()).nullable(),
  abbreviations: z.record(z.string(), z.string()).nullable(), // e.g. { "LF": "linear feet", "GALV": "galvanized" }
  material_conventions: z.array(z.string()).nullable(),
  general_specs: z.array(z.string()).nullable(),
  symbol_legend: z.record(z.string(), z.string()).nullable(), // e.g. { "flex duct": "wavy line symbol", "diffuser": "square with X" }
});

export type SpecExtractionOutput = z.infer<typeof specExtractionOutputSchema>;

export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;
export type ScheduleOutput = z.infer<typeof scheduleOutputSchema>;
export type ComponentExtractionOutput = z.infer<typeof componentExtractionOutputSchema>;
export type ReconciledComponent = z.infer<typeof reconciledComponentSchema>;
export type ReconciliationOutput = z.infer<typeof reconciliationOutputSchema>;
export type ValidatorOutput = z.infer<typeof validatorOutputSchema>;
export type QaAuditOutput = z.infer<typeof qaAuditOutputSchema>;
