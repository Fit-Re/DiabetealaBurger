import { computeStats } from "../db/database";
import { startOfDay } from "./dateTimeUtils";
import type { GlucoseReading } from "../types";

/** Clave local 'YYYY-MM-DD'. La misma forma que usa `lifestyle_metrics`. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export interface DailyStat {
  dateKey: string;
  /** Inicio del día local, en epoch ms. */
  dateMs: number;
  count: number;
  average: number;
  min: number;
  max: number;
  timeInRangePct: number;
  lowCount: number;
  highCount: number;
}

/**
 * Agrupa lecturas por día local y calcula estadísticas de cada uno.
 *
 * Solo devuelve días con al menos una lectura — un día sin registrar no es un
 * día con promedio cero, y pintarlo como barra vacía mentiría sobre los datos.
 * El resultado va de más viejo a más reciente.
 */
export function buildDailyStats(
  readings: GlucoseReading[],
  targetLow: number,
  targetHigh: number
): DailyStat[] {
  const byDay = new Map<string, GlucoseReading[]>();

  for (const reading of readings) {
    const day = startOfDay(new Date(reading.timestampMs));
    const key = toDateKey(day);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(reading);
    } else {
      byDay.set(key, [reading]);
    }
  }

  const stats: DailyStat[] = [];
  for (const [dateKey, dayReadings] of byDay) {
    const s = computeStats(dayReadings, targetLow, targetHigh);
    stats.push({
      dateKey,
      dateMs: startOfDay(new Date(dayReadings[0].timestampMs)).getTime(),
      count: s.count,
      average: s.average ?? 0,
      min: s.min ?? 0,
      max: s.max ?? 0,
      timeInRangePct: s.timeInRangePct ?? 0,
      lowCount: s.lowCount,
      highCount: s.highCount,
    });
  }

  return stats.sort((a, b) => a.dateMs - b.dateMs);
}

export type TrendDirection = "improving" | "stable" | "worsening";

export interface TrendSummary {
  direction: TrendDirection;
  /** Cambio en puntos porcentuales de tiempo en rango, con signo. */
  timeInRangeDelta: number;
  /** Cambio del promedio de glucosa en mg/dL, con signo. */
  averageDelta: number;
}

/** Por debajo de esto el cambio es ruido, no tendencia. */
const TIR_STABLE_THRESHOLD_PCT = 3;

/**
 * Compara la primera mitad del periodo contra la segunda.
 *
 * La dirección se decide por el tiempo en rango, no por el promedio: un
 * promedio que baja solo es una mejora si venías por encima del rango. Si el
 * paciente ya estaba bajo, bajar más es justo lo contrario. El tiempo en rango
 * no tiene esa ambigüedad, así que manda él y el promedio queda como detalle.
 *
 * Devuelve null si no hay al menos dos días: con uno solo no hay con qué comparar.
 */
export function computeTrend(daily: DailyStat[]): TrendSummary | null {
  if (daily.length < 2) return null;

  const mid = Math.floor(daily.length / 2);
  const older = daily.slice(0, mid);
  const newer = daily.slice(mid);

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const timeInRangeDelta =
    mean(newer.map((d) => d.timeInRangePct)) - mean(older.map((d) => d.timeInRangePct));
  const averageDelta = mean(newer.map((d) => d.average)) - mean(older.map((d) => d.average));

  const direction: TrendDirection =
    Math.abs(timeInRangeDelta) < TIR_STABLE_THRESHOLD_PCT
      ? "stable"
      : timeInRangeDelta > 0
      ? "improving"
      : "worsening";

  return { direction, timeInRangeDelta, averageDelta };
}

export interface RangeSummary {
  dayCount: number;
  readingCount: number;
  average: number | null;
  timeInRangePct: number | null;
  lowEvents: number;
  highEvents: number;
  /** 100 menos el coeficiente de variación de los promedios diarios. */
  stabilityPct: number | null;
}

/**
 * Resume el periodo completo.
 *
 * El promedio y el tiempo en rango se ponderan por número de lecturas: un día
 * con 20 lecturas no puede pesar lo mismo que uno con 1 sola.
 */
export function summarizeRange(daily: DailyStat[]): RangeSummary {
  if (daily.length === 0) {
    return {
      dayCount: 0,
      readingCount: 0,
      average: null,
      timeInRangePct: null,
      lowEvents: 0,
      highEvents: 0,
      stabilityPct: null,
    };
  }

  const readingCount = daily.reduce((sum, d) => sum + d.count, 0);
  const average = daily.reduce((sum, d) => sum + d.average * d.count, 0) / readingCount;
  const timeInRangePct =
    daily.reduce((sum, d) => sum + d.timeInRangePct * d.count, 0) / readingCount;

  // Estabilidad: qué tan parecidos son los promedios entre días. Con un solo
  // día no hay dispersión que medir, así que no se reporta.
  let stabilityPct: number | null = null;
  if (daily.length >= 2 && average > 0) {
    const dayAverages = daily.map((d) => d.average);
    const dayMean = dayAverages.reduce((a, b) => a + b, 0) / dayAverages.length;
    const variance =
      dayAverages.reduce((sum, v) => sum + (v - dayMean) ** 2, 0) / dayAverages.length;
    const cvPct = (Math.sqrt(variance) / dayMean) * 100;
    stabilityPct = Math.max(0, Math.min(100, 100 - cvPct));
  }

  return {
    dayCount: daily.length,
    readingCount,
    average,
    timeInRangePct,
    lowEvents: daily.reduce((sum, d) => sum + d.lowCount, 0),
    highEvents: daily.reduce((sum, d) => sum + d.highCount, 0),
    stabilityPct,
  };
}
