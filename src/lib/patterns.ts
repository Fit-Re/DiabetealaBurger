import type {
  GlucoseReading,
  LifestyleMetric,
  Meal,
  Medication,
  MedicationLog,
  PatternFinding,
} from "../types";
import { TARGET_RANGE } from "../types";

const NIGHT_START_HOUR = 0;
const NIGHT_END_HOUR = 6;
const DAWN_WINDOW_START_HOUR = 4;
const DAWN_WINDOW_END_HOUR = 7;
const BEDTIME_WINDOW_START_HOUR = 22;
const BEDTIME_WINDOW_END_HOUR = 24;

const MIN_READINGS_FOR_TIR = 10;
const MIN_NIGHTS_FOR_HYPO_PATTERN = 2;
const MIN_QUALIFYING_MEALS = 3;
const HIGH_CARB_THRESHOLD_G = 60;
const POST_MEAL_WINDOW_MS = 2 * 60 * 60 * 1000;
const POST_MEAL_HIGH_RATE_THRESHOLD = 0.5;
const DAWN_RISE_THRESHOLD_MG_DL = 20;
const MIN_DAYS_FOR_DAWN_PATTERN = 3;
const LOW_TIME_THRESHOLD_PCT = 4; // consenso ATTD/Battelino: <4% tiempo bajo rango
const TIR_TARGET_PCT = 70; // consenso ATTD/Battelino: >=70% tiempo en rango
const MEDICATION_ADHERENCE_WINDOW_DAYS = 7;
const MEDICATION_ADHERENCE_THRESHOLD = 0.7;

const MIN_READINGS_PER_DAY_FOR_CORRELATION = 4;
const MIN_LIFESTYLE_DAYS_FOR_CORRELATION = 6;
const MIN_GROUP_DAYS_FOR_CORRELATION = 2;
const LIFESTYLE_TIR_DIFFERENCE_THRESHOLD_PCT = 10;

function hourOf(timestampMs: number): number {
  return new Date(timestampMs).getHours();
}

function dayKeyOf(timestampMs: number): string {
  const d = new Date(timestampMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function detectDawnPhenomenon(readings: GlucoseReading[]): PatternFinding | null {
  const byDay = new Map<string, { bedtime: number[]; dawn: number[] }>();
  for (const r of readings) {
    const hour = hourOf(r.timestampMs);
    const key = dayKeyOf(r.timestampMs);
    if (!byDay.has(key)) byDay.set(key, { bedtime: [], dawn: [] });
    const entry = byDay.get(key)!;
    if (hour >= BEDTIME_WINDOW_START_HOUR && hour < BEDTIME_WINDOW_END_HOUR) {
      entry.bedtime.push(r.value);
    } else if (hour >= DAWN_WINDOW_START_HOUR && hour < DAWN_WINDOW_END_HOUR) {
      entry.dawn.push(r.value);
    }
  }

  let qualifyingDays = 0;
  let totalRise = 0;
  for (const { bedtime, dawn } of byDay.values()) {
    if (bedtime.length === 0 || dawn.length === 0) continue;
    const avgBedtime = bedtime.reduce((a, b) => a + b, 0) / bedtime.length;
    const avgDawn = dawn.reduce((a, b) => a + b, 0) / dawn.length;
    const rise = avgDawn - avgBedtime;
    if (rise >= DAWN_RISE_THRESHOLD_MG_DL) {
      qualifyingDays++;
      totalRise += rise;
    }
  }

  if (qualifyingDays < MIN_DAYS_FOR_DAWN_PATTERN) return null;

  const avgRise = totalRise / qualifyingDays;
  return {
    id: "dawn_phenomenon",
    title: "Posible fenómeno del alba",
    description: `En ${qualifyingDays} de los últimos días, tu glucosa subió en promedio ${avgRise.toFixed(0)} mg/dL entre la noche y la madrugada (4-7am) sin que hubiera una comida de por medio.`,
    severity: "watch",
    suggestedQuery: "fenómeno del alba: aumento de glucosa en la madrugada en diabetes tipo 1",
    evidenceCount: qualifyingDays,
  };
}

function detectNocturnalHypoglycemia(
  readings: GlucoseReading[],
  targetLow: number
): PatternFinding | null {
  const nightsWithHypo = new Set<string>();
  let hypoCount = 0;
  for (const r of readings) {
    const hour = hourOf(r.timestampMs);
    if (hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR && r.value < targetLow) {
      nightsWithHypo.add(dayKeyOf(r.timestampMs));
      hypoCount++;
    }
  }

  if (nightsWithHypo.size < MIN_NIGHTS_FOR_HYPO_PATTERN) return null;

  return {
    id: "nocturnal_hypoglycemia",
    title: "Hipoglucemia nocturna recurrente",
    description: `Se detectaron ${hypoCount} lecturas por debajo de ${targetLow} mg/dL entre medianoche y las 6am, en ${nightsWithHypo.size} noches distintas.`,
    severity: "attention",
    suggestedQuery: "factores de riesgo de hipoglucemia nocturna en diabetes tipo 1",
    evidenceCount: hypoCount,
  };
}

function detectPostMealHyperglycemia(
  readings: GlucoseReading[],
  meals: Meal[]
): PatternFinding | null {
  const qualifyingMeals = meals.filter(
    (m) => (m.carbsG ?? 0) >= HIGH_CARB_THRESHOLD_G
  );
  if (qualifyingMeals.length < MIN_QUALIFYING_MEALS) return null;

  let highCount = 0;
  let evaluated = 0;
  for (const meal of qualifyingMeals) {
    const postReadings = readings.filter(
      (r) =>
        r.timestampMs > meal.timestampMs &&
        r.timestampMs <= meal.timestampMs + POST_MEAL_WINDOW_MS
    );
    if (postReadings.length === 0) continue;
    evaluated++;
    const maxValue = Math.max(...postReadings.map((r) => r.value));
    if (maxValue > TARGET_RANGE.high) highCount++;
  }

  if (evaluated < MIN_QUALIFYING_MEALS) return null;
  const rate = highCount / evaluated;
  if (rate < POST_MEAL_HIGH_RATE_THRESHOLD) return null;

  return {
    id: "post_meal_hyperglycemia",
    title: "Glucosa alta después de comidas con muchos carbohidratos",
    description: `En ${highCount} de ${evaluated} comidas con ${HIGH_CARB_THRESHOLD_G}g+ de carbohidratos, tu glucosa superó ${TARGET_RANGE.high} mg/dL dentro de las 2 horas siguientes.`,
    severity: "watch",
    suggestedQuery: "control glucémico postprandial y conteo de carbohidratos en diabetes tipo 1",
    evidenceCount: evaluated,
  };
}

function detectLowTimeInRange(readings: GlucoseReading[]): PatternFinding | null {
  if (readings.length < MIN_READINGS_FOR_TIR) return null;

  const total = readings.length;
  const lowCount = readings.filter((r) => r.value < TARGET_RANGE.low).length;
  const inRangeCount = readings.filter(
    (r) => r.value >= TARGET_RANGE.low && r.value <= TARGET_RANGE.high
  ).length;

  const lowPct = (lowCount / total) * 100;
  const tirPct = (inRangeCount / total) * 100;

  if (lowPct > LOW_TIME_THRESHOLD_PCT) {
    return {
      id: "low_time_below_range",
      title: "Tiempo bajo rango por encima del objetivo de consenso",
      description: `${lowPct.toFixed(1)}% de tus lecturas recientes están por debajo de ${TARGET_RANGE.low} mg/dL. El consenso internacional (ATTD/Battelino 2019) recomienda mantener esto por debajo del ${LOW_TIME_THRESHOLD_PCT}%.`,
      severity: "attention",
      suggestedQuery: "objetivos de tiempo en rango y tiempo bajo rango en diabetes tipo 1",
      evidenceCount: total,
    };
  }

  if (tirPct < TIR_TARGET_PCT) {
    return {
      id: "low_time_in_range",
      title: "Tiempo en rango por debajo del objetivo de consenso",
      description: `Tu tiempo en rango (70-180 mg/dL) de los últimos días es ${tirPct.toFixed(1)}%, por debajo del objetivo de consenso del ${TIR_TARGET_PCT}% (ATTD/Battelino 2019).`,
      severity: "watch",
      suggestedQuery: "objetivos de tiempo en rango en diabetes tipo 1",
      evidenceCount: total,
    };
  }

  return null;
}

function detectMedicationAdherence(
  medications: Medication[],
  logs: MedicationLog[],
  windowDays: number = MEDICATION_ADHERENCE_WINDOW_DAYS
): PatternFinding | null {
  const scheduled = medications.filter((m) => m.scheduleTimes.length > 0);
  if (scheduled.length === 0) return null;

  const expectedTotal = scheduled.reduce(
    (sum, m) => sum + m.scheduleTimes.length * windowDays,
    0
  );
  if (expectedTotal === 0) return null;

  const actualTotal = logs.filter((l) =>
    scheduled.some((m) => m.id === l.medicationId)
  ).length;

  const rate = actualTotal / expectedTotal;
  if (rate >= MEDICATION_ADHERENCE_THRESHOLD) return null;
  if (expectedTotal < 3) return null;

  return {
    id: "medication_adherence",
    title: "Posibles tomas de medicamento no registradas",
    description: `Con base en tus horarios configurados, se esperaban ~${expectedTotal} tomas en los últimos ${windowDays} días, pero solo hay ${actualTotal} registradas (${(rate * 100).toFixed(0)}%). Puede ser falta de registro o dosis realmente omitidas.`,
    severity: "info",
    suggestedQuery: "adherencia al tratamiento con insulina en diabetes tipo 1",
    evidenceCount: actualTotal,
  };
}

interface LifestyleDayGlucose {
  metricValue: number;
  tirPct: number;
}

// Ultrahuman etiqueta el día D con la sesión de sueño que termina esa mañana,
// así que se correlaciona con la glucosa del mismo día calendario D (no del
// día siguiente).
function buildDailyLifestyleGlucose(
  readings: GlucoseReading[],
  lifestyleMetrics: LifestyleMetric[],
  metricKey: "sleepScore" | "hrvMs"
): LifestyleDayGlucose[] {
  const byDay = new Map<string, GlucoseReading[]>();
  for (const r of readings) {
    const key = dayKeyOf(r.timestampMs);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }

  const result: LifestyleDayGlucose[] = [];
  for (const m of lifestyleMetrics) {
    const value = m[metricKey];
    if (typeof value !== "number") continue;
    const dayReadings = byDay.get(dayKeyOf(m.dateMs));
    if (!dayReadings || dayReadings.length < MIN_READINGS_PER_DAY_FOR_CORRELATION) continue;
    const inRangeCount = dayReadings.filter(
      (r) => r.value >= TARGET_RANGE.low && r.value <= TARGET_RANGE.high
    ).length;
    result.push({
      metricValue: value,
      tirPct: (inRangeCount / dayReadings.length) * 100,
    });
  }
  return result;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function detectLifestyleCorrelation(
  days: LifestyleDayGlucose[],
  id: string,
  title: string,
  lowLabel: string,
  highLabel: string,
  suggestedQuery: string
): PatternFinding | null {
  if (days.length < MIN_LIFESTYLE_DAYS_FOR_CORRELATION) return null;

  const sorted = [...days].sort((a, b) => a.metricValue - b.metricValue);
  const groupSize = Math.floor(sorted.length / 2);
  const lowGroup = sorted.slice(0, groupSize);
  const highGroup = sorted.slice(sorted.length - groupSize);
  if (
    lowGroup.length < MIN_GROUP_DAYS_FOR_CORRELATION ||
    highGroup.length < MIN_GROUP_DAYS_FOR_CORRELATION
  ) {
    return null;
  }

  const avgTirLow = average(lowGroup.map((d) => d.tirPct));
  const avgTirHigh = average(highGroup.map((d) => d.tirPct));
  const diff = avgTirHigh - avgTirLow;
  if (diff < LIFESTYLE_TIR_DIFFERENCE_THRESHOLD_PCT) return null;

  return {
    id,
    title,
    description: `En días con ${lowLabel}, tu tiempo en rango promedió ${avgTirLow.toFixed(0)}%, comparado con ${avgTirHigh.toFixed(0)}% en días con ${highLabel} (${days.length} días con datos de Ultrahuman analizados).`,
    severity: "watch",
    suggestedQuery,
    evidenceCount: days.length,
  };
}

export function detectPatterns(
  readings: GlucoseReading[],
  meals: Meal[],
  medications: Medication[],
  medicationLogs: MedicationLog[],
  lifestyleMetrics: LifestyleMetric[] = [],
  targetLow: number = TARGET_RANGE.low
): PatternFinding[] {
  const sleepDays = buildDailyLifestyleGlucose(readings, lifestyleMetrics, "sleepScore");
  const hrvDays = buildDailyLifestyleGlucose(readings, lifestyleMetrics, "hrvMs");

  const findings = [
    detectLowTimeInRange(readings),
    detectNocturnalHypoglycemia(readings, targetLow),
    detectDawnPhenomenon(readings),
    detectPostMealHyperglycemia(readings, meals),
    detectMedicationAdherence(medications, medicationLogs),
    detectLifestyleCorrelation(
      sleepDays,
      "sleep_quality_glucose",
      "Sueño de baja calidad y tiempo en rango",
      "menor puntaje de sueño (Ultrahuman)",
      "mayor puntaje de sueño",
      "calidad del sueño y control glucémico en diabetes tipo 1"
    ),
    detectLifestyleCorrelation(
      hrvDays,
      "hrv_glucose",
      "Variabilidad cardíaca baja y tiempo en rango",
      "HRV más baja (posible estrés/fatiga)",
      "HRV más alta",
      "variabilidad de frecuencia cardíaca (HRV) y control glucémico en diabetes tipo 1"
    ),
  ].filter((f): f is PatternFinding => f !== null);

  const severityOrder: Record<PatternFinding["severity"], number> = {
    attention: 0,
    watch: 1,
    info: 2,
  };
  return findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
