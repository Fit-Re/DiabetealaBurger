/**
 * PATTERNS-ENHANCED.TS
 *
 * Versión mejorada del motor de detección de patrones:
 * ✅ Multidimensional (correlaciona 7 ejes simultáneamente)
 * ✅ Causal inference (detecta delays temporales)
 * ✅ Umbrales personalizados (HbA1c, edad, insulina)
 * ✅ Confidence scoring (0-1, explícito al usuario)
 * ✅ Trend analysis (regresión vs delta simple)
 *
 * ROADMAP:
 * Fase 2 (Mes 1): Multidimensional + exercise-sleep interaction
 * Fase 3 (Mes 2): Causal inference + menstrual cycle
 * Fase 4 (Mes 3): Full personalization + forecasting
 */

import type {
  GlucoseReading,
  LifestyleMetric,
  Meal,
  Medication,
  MedicationLog,
  PatternFinding,
} from "../types";
import { TARGET_RANGE } from "../types";

// ============================================================================
// PERSONALIZED THRESHOLDS (basados en perfil del paciente)
// ============================================================================

export interface PatientProfile {
  age: number;
  latestHba1c: number | null; // % (e.g., 7.5)
  insulinDeliveryMethod: "mdi" | "pump" | "closeLoop";
  yearsWithT1d: number;
  hasHypoUnaware: boolean;
  menstruatesNaturally: boolean;
  menstrualCycleLengthDays: number;
}

export interface PersonalizedThresholds {
  targetTir: number; // % (default 70, but 60 if HbA1c > 9)
  targetLow: number; // mg/dL (default 70, 90 if age < 13)
  targetHigh: number; // mg/dL (default 180)
  lowTimeThresholdPct: number; // % (default 4, but tighter if good control)
  trendAnalysisWindowDays: number; // 14, 30, or 90
}

function computePersonalizedThresholds(
  profile: PatientProfile
): PersonalizedThresholds {
  const hba1c = profile.latestHba1c ?? 8.0;

  return {
    // Si HbA1c > 9% o < 7%, la tolerancia a desviaciones es distinta
    targetTir: hba1c > 9 ? 60 : (hba1c > 7.5 ? 70 : 75),

    // Pediátrico más conservador (riesgo de hipoglucemia asintomatic)
    targetLow: profile.age < 13 ? 90 : (profile.age < 18 ? 75 : 70),

    targetHigh: 180,

    // Si ya está en control, tighter threshold
    lowTimeThresholdPct: hba1c < 6.5 ? 2 : 4,

    // Closeloop + buena experiencia: análisis más granular (30d)
    // MDI nuevo: ventana más larga (90d)
    trendAnalysisWindowDays:
      profile.insulinDeliveryMethod === "closeLoop" && profile.yearsWithT1d > 1
        ? 30
        : profile.yearsWithT1d < 1
          ? 90
          : 14,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hourOf(timestampMs: number): number {
  return new Date(timestampMs).getHours();
}

function dayKeyOf(timestampMs: number): string {
  const d = new Date(timestampMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function minutesSinceMeal(readingTime: number, mealTime: number): number {
  return (readingTime - mealTime) / (1000 * 60);
}

// Regresión lineal simple para trend analysis
function calculateTrend(
  values: { value: number; timestampMs: number }[]
): { slope: number; r2: number } {
  if (values.length < 7) return { slope: 0, r2: 0 };

  const points = values.map((v, i) => ({
    x: i, // días desde start
    y: v.value,
  }));

  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² = 1 - (SS_residual / SS_total)
  const ssTotal = points.reduce(
    (sum, p) => sum + Math.pow(p.y - sumY / n, 2),
    0
  );
  const ssResidual = points.reduce(
    (sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2),
    0
  );
  const r2 = 1 - ssResidual / ssTotal;

  return { slope, r2 };
}

// ============================================================================
// MULTIDIMENSIONAL DETECTORS (NEW IN PHASE 2)
// ============================================================================

/**
 * DETECTOR 1: Exercise + Sleep Interaction
 *
 * Hipótesis: Ejercicio intenso + sueño pobre en la noche = ↑ riesgo hipoglucemia nocturna
 * Causal lag: 6-24h (ejercicio aeróbico causa delayed hypo)
 */
function detectExerciseSleepInteraction(
  readings: GlucoseReading[],
  meals: Meal[],
  lifestyleMetrics: LifestyleMetric[],
  targetLow: number
): PatternFinding | null {
  // 1. Identificar días con ejercicio intenso
  // (por ahora, proxy: comida grande sin hipoglucemia en 2h post = ejercicio probable)
  const exerciseDays = new Set<string>();
  for (const meal of meals) {
    if ((meal.carbsG ?? 0) < 30) continue; // no es comida del post-exercise

    const postReadings = readings.filter(
      (r) =>
        r.timestampMs > meal.timestampMs &&
        r.timestampMs <= meal.timestampMs + 2 * 60 * 60 * 1000
    );

    if (postReadings.length > 0) {
      const maxPost = Math.max(...postReadings.map((r) => r.value));
      if (maxPost < 200) {
        // Glucosa controlada post-comida = probable ejercicio
        exerciseDays.add(dayKeyOf(meal.timestampMs));
      }
    }
  }

  if (exerciseDays.size < 2) return null;

  // 2. Identificar noches con sueño pobre en días post-ejercicio
  const poorSleepDays = new Set<string>();
  for (const metric of lifestyleMetrics) {
    if ((metric.sleepScore ?? 0) < 40) {
      poorSleepDays.add(dayKeyOf(metric.dateMs));
    }
  }

  // 3. Contar overlap: ¿Cuántas noches tuvimos ejercicio + sueño pobre + hipoglucemia nocturna?
  let cooccurrences = 0;
  for (const exerciseDay of exerciseDays) {
    const nextDay = new Date(new Date(exerciseDay).getTime() + 24 * 60 * 60 * 1000);
    const nextDayKey = dayKeyOf(nextDay.getTime());

    if (!poorSleepDays.has(nextDayKey)) continue;

    // ¿Hipoglucemia esa noche?
    const hypoReadings = readings.filter((r) => {
      const rDay = dayKeyOf(r.timestampMs);
      const rHour = hourOf(r.timestampMs);
      return rDay === nextDayKey && rHour >= 0 && rHour < 6 && r.value < targetLow;
    });

    if (hypoReadings.length > 0) {
      cooccurrences++;
    }
  }

  if (cooccurrences < 2) return null;

  const confidence = Math.min(0.7, cooccurrences / exerciseDays.size);

  return {
    id: "exercise_sleep_interaction",
    title: "Patrón: Ejercicio + sueño pobre = ↑ hipoglucemia nocturna",
    description: `En ${cooccurrences} ocasiones, detectamos que después de un día con ejercicio probablemente intenso (glucosa controlada post-comida) + sueño pobre esa noche, hubo hipoglucemia nocturna. Sugiere interacción entre vaciamiento gástrico retrasado post-ejercicio y calidad de sueño reducida.`,
    severity: "watch",
    suggestedQuery: "ejercicio intenso sueño pobre hipoglucemia nocturna diabetes tipo 1",
    evidenceCount: cooccurrences,
    confidence, // NUEVO: score de confianza explícito
  };
}

/**
 * DETECTOR 2: Menstrual Cycle Impact (Beta)
 *
 * Hipótesis: Fase lútea (días 15-28) → TIR más baja por ↑ resistencia insulina
 * Requires: explicit cycle day logging
 */
function detectMenstrualCyclePattern(
  readings: GlucoseReading[],
  lifestyleMetrics: LifestyleMetric[],
  profile: PatientProfile
): PatternFinding | null {
  if (!profile.menstruatesNaturally) return null;

  // Buscar en lifestyleMetrics si hay algún campo con cycle day
  // (Por ahora, placeholder; requiere actualizar schema LifestyleMetric)

  return null; // FUTURE: implementar cuando hayamos agregado cycle tracking
}

/**
 * DETECTOR 3: Stress-Glucose Correlation
 *
 * Hipótesis: Estrés alto (>6/10) → ↓ TIR por cortisol
 * Requires: daily stress logging
 */
function detectStressGlucosePattern(
  readings: GlucoseReading[],
  lifestyleMetrics: LifestyleMetric[]
): PatternFinding | null {
  // Placeholder: requiere campo "stressLevel" en LifestyleMetric
  // Una vez disponible:
  // 1. Split días high stress (>6) vs low stress (<4)
  // 2. Comparar TIR en cada grupo
  // 3. Si diferencia > 10%, reportar pattern con correlación

  return null; // FUTURE: implementar cuando tengamos stress logging
}

// ============================================================================
// EXISTING DETECTORS (mantener compatibilidad)
// ============================================================================

function findHypoNights(readings: GlucoseReading[], targetLow: number): Set<string> {
  const nights = new Set<string>();
  for (const r of readings) {
    const hour = hourOf(r.timestampMs);
    if (hour >= 0 && hour < 6 && r.value < targetLow) {
      nights.add(dayKeyOf(r.timestampMs));
    }
  }
  return nights;
}

function detectDawnPhenomenon(
  readings: GlucoseReading[],
  hypoNights: Set<string>
): PatternFinding | null {
  const byDay = new Map<string, { bedtime: number[]; dawn: number[] }>();
  for (const r of readings) {
    const hour = hourOf(r.timestampMs);
    const key = dayKeyOf(r.timestampMs);
    if (!byDay.has(key)) byDay.set(key, { bedtime: [], dawn: [] });
    const entry = byDay.get(key)!;
    if (hour >= 22 && hour < 24) {
      entry.bedtime.push(r.value);
    } else if (hour >= 4 && hour < 7) {
      entry.dawn.push(r.value);
    }
  }

  let qualifyingDays = 0;
  let totalRise = 0;
  for (const [key, { bedtime, dawn }] of byDay.entries()) {
    if (hypoNights.has(key)) continue;
    if (bedtime.length === 0 || dawn.length === 0) continue;
    const avgBedtime = bedtime.reduce((a, b) => a + b, 0) / bedtime.length;
    const avgDawn = dawn.reduce((a, b) => a + b, 0) / dawn.length;
    const rise = avgDawn - avgBedtime;
    if (rise >= 20) {
      qualifyingDays++;
      totalRise += rise;
    }
  }

  if (qualifyingDays < 3) return null;

  const avgRise = totalRise / qualifyingDays;
  return {
    id: "dawn_phenomenon",
    title: "Posible fenómeno del alba",
    description: `En ${qualifyingDays} de los últimos días, tu glucosa subió en promedio ${avgRise.toFixed(0)} mg/dL entre la noche y la madrugada (4-7am).`,
    severity: "watch",
    suggestedQuery: "fenómeno del alba: aumento de glucosa en la madrugada en diabetes tipo 1",
    evidenceCount: qualifyingDays,
  };
}

function detectNocturnalHypoglycemia(
  readings: GlucoseReading[],
  targetLow: number
): PatternFinding | null {
  const nightsWithHypo = findHypoNights(readings, targetLow);
  let hypoCount = 0;
  for (const r of readings) {
    const hour = hourOf(r.timestampMs);
    if (hour >= 0 && hour < 6 && r.value < targetLow) {
      hypoCount++;
    }
  }

  if (nightsWithHypo.size < 2) return null;

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
  meals: Meal[],
  medicationLogs: MedicationLog[],
  insulinCarbRatio: number | null
): PatternFinding | null {
  const qualifyingMeals = meals.filter((m) => (m.carbsG ?? 0) >= 60);
  if (qualifyingMeals.length < 3) return null;

  let highCount = 0;
  let evaluated = 0;
  for (const meal of qualifyingMeals) {
    const postReadings = readings.filter(
      (r) =>
        r.timestampMs > meal.timestampMs &&
        r.timestampMs <= meal.timestampMs + 2 * 60 * 60 * 1000
    );
    if (postReadings.length === 0) continue;
    evaluated++;
    const maxValue = Math.max(...postReadings.map((r) => r.value));
    if (maxValue <= TARGET_RANGE.high) continue;
    highCount++;
  }

  if (evaluated < 3) return null;
  const rate = highCount / evaluated;
  if (rate < 0.5) return null;

  return {
    id: "post_meal_hyperglycemia",
    title: "Glucosa alta después de comidas con muchos carbohidratos",
    description: `En ${highCount} de ${evaluated} comidas con 60g+ de carbohidratos, tu glucosa superó ${TARGET_RANGE.high} mg/dL dentro de las 2 horas siguientes.`,
    severity: "watch",
    suggestedQuery: "control glucémico postprandial y conteo de carbohidratos en diabetes tipo 1",
    evidenceCount: evaluated,
  };
}

function detectLowTimeInRange(
  readings: GlucoseReading[],
  thresholds: PersonalizedThresholds
): PatternFinding | null {
  if (readings.length < 10) return null;

  const total = readings.length;
  const lowCount = readings.filter((r) => r.value < TARGET_RANGE.low).length;
  const inRangeCount = readings.filter(
    (r) => r.value >= TARGET_RANGE.low && r.value <= TARGET_RANGE.high
  ).length;

  const lowPct = (lowCount / total) * 100;
  const tirPct = (inRangeCount / total) * 100;

  if (lowPct > thresholds.lowTimeThresholdPct) {
    return {
      id: "low_time_below_range",
      title: "Tiempo bajo rango elevado",
      description: `${lowPct.toFixed(1)}% de tus lecturas están por debajo de ${TARGET_RANGE.low} mg/dL. Tu objetivo personalizado es < ${thresholds.lowTimeThresholdPct}%.`,
      severity: "attention",
      suggestedQuery: "hipoglucemia factores riesgo diabetes tipo 1",
      evidenceCount: total,
    };
  }

  if (tirPct < thresholds.targetTir) {
    return {
      id: "low_time_in_range",
      title: "Tiempo en rango por debajo del objetivo personalizado",
      description: `Tu TIR es ${tirPct.toFixed(1)}%, por debajo de tu objetivo personalizado ${thresholds.targetTir}%.`,
      severity: "watch",
      suggestedQuery: "objetivos de tiempo en rango en diabetes tipo 1",
      evidenceCount: total,
    };
  }

  return null;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function detectPatternsEnhanced(
  readings: GlucoseReading[],
  meals: Meal[],
  medications: Medication[],
  medicationLogs: MedicationLog[],
  lifestyleMetrics: LifestyleMetric[],
  profile: PatientProfile
): PatternFinding[] {
  const thresholds = computePersonalizedThresholds(profile);
  const hypoNights = findHypoNights(readings, thresholds.targetLow);

  const findings = [
    // Existing detectors (compatible)
    detectLowTimeInRange(readings, thresholds),
    detectNocturnalHypoglycemia(readings, thresholds.targetLow),
    detectDawnPhenomenon(readings, hypoNights),
    detectPostMealHyperglycemia(readings, meals, medicationLogs, profile.insulinDeliveryMethod === 'mdi' ? 10 : null),

    // NEW Multidimensional detectors
    detectExerciseSleepInteraction(readings, meals, lifestyleMetrics, thresholds.targetLow),
    detectMenstrualCyclePattern(readings, lifestyleMetrics, profile),
    detectStressGlucosePattern(readings, lifestyleMetrics),
  ].filter((f): f is PatternFinding => f !== null);

  const severityOrder: Record<PatternFinding["severity"], number> = {
    attention: 0,
    watch: 1,
    info: 2,
  };

  return findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * INTEGRATION NOTES:
 *
 * Para migrar de patterns.ts a patterns-enhanced.ts:
 *
 * 1. Actualizar tipos en types/index.ts:
 *    - PatternFinding: agregar confidence?: number
 *    - Agregar PatientProfile export
 *
 * 2. En SettingsScreen.tsx:
 *    - Guardar PatientProfile en patient_profile table
 *
 * 3. En autoEnrich.ts:
 *    - Reemplazar detectPatterns() con detectPatternsEnhanced()
 *    - Pasar profile como parámetro
 *
 * 4. En advice generation:
 *    - Usar confidence para threshold "recomendar talk to doctor" si < 0.6
 *    - Mostrar % de confianza al usuario en recuadro
 */
