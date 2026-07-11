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
