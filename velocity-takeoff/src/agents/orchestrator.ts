import { runClassifier } from './classifier';
import { runComponentSpotter } from './component-spotter';
import { runMeasurement } from './measurement';
import { runQaAuditor } from './qa-auditor';
import { runReconciliation } from './reconciliation';
import { runScheduleReader } from './schedule-reader';
import { runValidator } from './validator';

const SOURCE_KEY = Symbol.for('analysis_error_source');

async function withSource<T>(source: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const wrapped = new Error(`[${source}] ${msg}`);
    (wrapped as unknown as { [SOURCE_KEY]: string })[SOURCE_KEY] = source;
    wrapped.cause = e instanceof Error ? e : new Error(String(e));
    throw wrapped;
  }
}

export function getErrorSource(err: unknown): string | null {
  const o = err as unknown as { [SOURCE_KEY]?: string };
  return (o && o[SOURCE_KEY]) ?? null;
}
import type {
  ClassifierOutput,
  ComponentExtractionOutput,
  ReconciliationOutput,
  ScheduleOutput,
  ValidatorOutput,
  QaAuditOutput,
} from './schemas';
import type { ReconciledComponent } from './schemas';

export type TakeoffScope = 'ductwork' | 'devices_equipment' | 'everything';

export type SpecContext = {
  scale_notations?: string[] | null;
  abbreviations?: Record<string, string> | null;
  material_conventions?: string[] | null;
  general_specs?: string[] | null;
};

export type SheetContext = {
  sheetId: string;
  imageBase64: string;
  scaleStr: string;
  scaleRatio: number;
  pixelsPerFoot: number;
  sheetNumber?: string | null;
  takeoffScope?: TakeoffScope;
  specContext?: SpecContext | null;
  scheduleContext?: ScheduleOutput | null;
  preClassified?: ClassifierOutput | null;
};

export type OrchestratorResult = {
  classifier: ClassifierOutput;
  schedule: ScheduleOutput | null;
  componentSpotter: { claude: ComponentExtractionOutput; gpt4o: ComponentExtractionOutput } | null;
  reconciliation: ReconciliationOutput | null;
  measurement: ComponentExtractionOutput | null;
  validator: ValidatorOutput | null;
  qaAudit: QaAuditOutput | null;
};

/**
 * Coordinates all agents for a single sheet.
 * Runs in parallel where possible:
 * - Classifier first (determines flow)
 * - Schedule + Component Spotter in parallel when applicable
 * - Reconciliation after component spotter
 * - Measurement in parallel with reconciliation (both use scale)
 * - Validator + QA Auditor after we have full data
 */
export async function runSheetPipeline(
  ctx: SheetContext
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    classifier: { sheet_types: [], sheet_number: null, sheet_title: null },
    schedule: null,
    componentSpotter: null,
    reconciliation: null,
    measurement: null,
    validator: null,
    qaAudit: null,
  };

  // 1. Classify sheet (or use pre-classified result from phase 1)
  result.classifier = ctx.preClassified ?? await withSource('classifier', () =>
    runClassifier({ imageBase64: ctx.imageBase64 })
  );

  const hasSchedule = result.classifier.sheet_types.includes('EQUIPMENT_SCHEDULE');
  const hasPlanOrDetail = result.classifier.sheet_types.some((t) =>
    ['FLOOR_PLAN', 'DETAIL'].includes(t)
  );

  // 2. Parallel: schedule reader (if schedule) + component spotter (if plan/detail)
  const [scheduleResult, componentResult, measurementResult] = await Promise.all([
    hasSchedule
      ? withSource('schedule-reader', () =>
          runScheduleReader({ imageBase64: ctx.imageBase64 })
        )
      : Promise.resolve(null),
    hasPlanOrDetail
      ? withSource('component-spotter', () =>
          runComponentSpotter({
            imageBase64: ctx.imageBase64,
            takeoffScope: ctx.takeoffScope,
            specContext: ctx.specContext,
            scheduleContext: ctx.scheduleContext,
          })
        )
      : Promise.resolve(null),
    hasPlanOrDetail
      ? withSource('measurement', () =>
          runMeasurement({
            imageBase64: ctx.imageBase64,
            scaleStr: ctx.scaleStr,
            scaleRatio: ctx.scaleRatio,
            pixelsPerFoot: ctx.pixelsPerFoot,
            sheetNumber: ctx.sheetNumber,
            specContext: ctx.specContext,
            scheduleContext: ctx.scheduleContext,
          })
        )
      : Promise.resolve(null),
  ]);

  result.schedule = scheduleResult;
  result.componentSpotter = componentResult;
  result.measurement = measurementResult;

  // 3. Reconcile dual extractions (Claude + GPT-4o)
  if (componentResult) {
    result.reconciliation = await withSource('reconciliation', () =>
      runReconciliation({
        claudeExtraction: componentResult.claude,
        gpt4oExtraction: componentResult.gpt4o,
      })
    );
  }

  // 4. Validator (cross-check components + schedule)
  const componentsToValidate: ReconciledComponent[] =
    result.reconciliation?.components ?? [];
  if (componentsToValidate.length > 0) {
    result.validator = await withSource('validator', () =>
      runValidator({
        components: componentsToValidate,
        schedule: result.schedule,
        sheetTypes: result.classifier.sheet_types,
      })
    );
  }

  // 5. QA Auditor (independent review)
  if (componentsToValidate.length > 0) {
    const scheduleEquipment = (result.schedule?.equipment ?? []).map((e) => ({
      tag: e.tag,
      description: e.description,
    }));
    result.qaAudit = await withSource('qa-auditor', () =>
      runQaAuditor({
        components: componentsToValidate,
        scheduleEquipment,
      })
    );
  }

  return result;
}
