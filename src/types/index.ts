export type GlucoseUnit = "mg/dL" | "mmol/L";

export type ReadingSource = "manual" | "librelink";

export type TrendArrow =
  | "rising_fast"
  | "rising"
  | "steady"
  | "falling"
  | "falling_fast"
  | null;

export interface GlucoseReading {
  id: number;
  value: number;
  unit: GlucoseUnit;
  timestampMs: number;
  source: ReadingSource;
  trend: TrendArrow;
  notes: string | null;
  createdAtMs: number;
}

export interface NewGlucoseReading {
  value: number;
  unit: GlucoseUnit;
  timestampMs: number;
  source: ReadingSource;
  trend: TrendArrow;
  notes: string | null;
}

export interface RangeStats {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  timeInRangePct: number | null;
  lowCount: number;
  highCount: number;
}

export const TARGET_RANGE = {
  low: 70,
  high: 180,
};

export const TREND_LABELS: Record<NonNullable<TrendArrow>, string> = {
  rising_fast: "↑↑ Subiendo rápido",
  rising: "↑ Subiendo",
  steady: "→ Estable",
  falling: "↓ Bajando",
  falling_fast: "↓↓ Bajando rápido",
};

export type MedicationType =
  | "insulin_basal"
  | "insulin_bolus"
  | "sensitizer"
  | "supplement"
  | "other";

export const MEDICATION_TYPE_LABELS: Record<MedicationType, string> = {
  insulin_basal: "Insulina basal (lenta)",
  insulin_bolus: "Insulina bolo (rápida)",
  sensitizer: "Sensibilizador (ej. metformina)",
  supplement: "Suplemento",
  other: "Otro",
};

export interface Medication {
  id: number;
  name: string;
  type: MedicationType;
  doseAmount: number | null;
  doseUnit: string | null;
  scheduleTimes: string[];
  notes: string | null;
  active: boolean;
  notificationIds: string[];
  createdAtMs: number;
}

export interface NewMedication {
  name: string;
  type: MedicationType;
  doseAmount: number | null;
  doseUnit: string | null;
  scheduleTimes: string[];
  notes: string | null;
}

export interface MedicationLog {
  id: number;
  medicationId: number;
  takenAtMs: number;
  doseAmount: number | null;
  notes: string | null;
  createdAtMs: number;
}

export interface NewMedicationLog {
  medicationId: number;
  takenAtMs: number;
  doseAmount: number | null;
  notes: string | null;
}

export interface MealItem {
  name: string;
  portionEstimate: string | null;
  calories: number | null;
  carbsG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  fatG: number | null;
}

export type MealSource = "photo" | "manual";

export interface Meal {
  id: number;
  timestampMs: number;
  description: string | null;
  calories: number | null;
  carbsG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  fatG: number | null;
  portionEstimate: string | null;
  items: MealItem[];
  source: MealSource;
  aiNotes: string | null;
  createdAtMs: number;
}

export interface NewMeal {
  timestampMs: number;
  description: string | null;
  calories: number | null;
  carbsG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  fatG: number | null;
  portionEstimate: string | null;
  items: MealItem[];
  source: MealSource;
  aiNotes: string | null;
}

export interface MealTotals {
  count: number;
  calories: number;
  carbsG: number;
  sugarG: number;
  proteinG: number;
  fatG: number;
}

export type KnowledgeTopic =
  | "cgm_targets"
  | "dawn_phenomenon"
  | "exercise"
  | "sleep"
  | "stress"
  | "carb_counting"
  | "hypoglycemia"
  | "general";

export interface KnowledgeCorpusEntry {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  url: string | null;
  topic: KnowledgeTopic;
  summary: string;
}

export interface KnowledgeChunk extends KnowledgeCorpusEntry {
  rowId: number;
  embedding: number[];
  curated: boolean;
  createdAtMs: number;
}

export interface KnowledgeSearchResult extends KnowledgeChunk {
  score: number;
}

export type PatternSeverity = "info" | "watch" | "attention";

export interface PatternFinding {
  id: string;
  title: string;
  description: string;
  severity: PatternSeverity;
  suggestedQuery: string;
  evidenceCount: number;
}
