import { supabase } from "../lib/supabase";
import type {
  GlucoseReading,
  KnowledgeChunk,
  KnowledgeCorpusEntry,
  LifestyleMetric,
  Meal,
  MealItem,
  MealTotals,
  Medication,
  MedicationLog,
  MedicationType,
  NewGlucoseReading,
  NewLifestyleMetric,
  NewMeal,
  NewMedication,
  NewMedicationLog,
  RangeStats,
} from "../types";
import { TARGET_RANGE } from "../types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function insertReading(
  reading: NewGlucoseReading
): Promise<number> {
  const result = await supabase
    .from("glucose_readings")
    .insert({
      value: reading.value,
      unit: reading.unit,
      timestamp_ms: reading.timestampMs,
      source: reading.source,
      trend: reading.trend,
      notes: reading.notes,
    })
    .select("id")
    .single();
  return unwrap(result).id;
}

export async function deleteReading(id: number): Promise<void> {
  const { error } = await supabase.from("glucose_readings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

interface GlucoseReadingRow {
  id: number;
  value: number;
  unit: GlucoseReading["unit"];
  timestamp_ms: number;
  source: GlucoseReading["source"];
  trend: GlucoseReading["trend"];
  notes: string | null;
  created_at_ms: number;
}

function mapGlucoseReadingRow(row: GlucoseReadingRow): GlucoseReading {
  return {
    id: row.id,
    value: row.value,
    unit: row.unit,
    timestampMs: row.timestamp_ms,
    source: row.source,
    trend: row.trend,
    notes: row.notes,
    createdAtMs: row.created_at_ms,
  };
}

export async function getReadingsSince(
  sinceMs: number
): Promise<GlucoseReading[]> {
  const result = await supabase
    .from("glucose_readings")
    .select("*")
    .gte("timestamp_ms", sinceMs)
    .order("timestamp_ms", { ascending: false });
  return unwrap<GlucoseReadingRow[]>(result).map(mapGlucoseReadingRow);
}

export async function getReadingsBetween(
  startMs: number,
  endMs: number
): Promise<GlucoseReading[]> {
  const result = await supabase
    .from("glucose_readings")
    .select("*")
    .gte("timestamp_ms", startMs)
    .lt("timestamp_ms", endMs)
    .order("timestamp_ms", { ascending: false });
  return unwrap<GlucoseReadingRow[]>(result).map(mapGlucoseReadingRow);
}

export async function getRecentReadings(
  limit: number = 20
): Promise<GlucoseReading[]> {
  const result = await supabase
    .from("glucose_readings")
    .select("*")
    .order("timestamp_ms", { ascending: false })
    .limit(limit);
  return unwrap<GlucoseReadingRow[]>(result).map(mapGlucoseReadingRow);
}

export function computeStats(
  readings: GlucoseReading[],
  low: number = TARGET_RANGE.low,
  high: number = TARGET_RANGE.high
): RangeStats {
  if (readings.length === 0) {
    return {
      count: 0,
      average: null,
      min: null,
      max: null,
      timeInRangePct: null,
      lowCount: 0,
      highCount: 0,
    };
  }
  const values = readings.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const lowCount = values.filter((v) => v < low).length;
  const highCount = values.filter((v) => v > high).length;
  const inRangeCount = values.length - lowCount - highCount;
  return {
    count: values.length,
    average: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    timeInRangePct: (inRangeCount / values.length) * 100,
    lowCount,
    highCount,
  };
}

interface MedicationRow {
  id: number;
  name: string;
  type: MedicationType;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_times: string[];
  notes: string | null;
  active: boolean;
  notification_ids: string[];
  created_at_ms: number;
}

function mapMedicationRow(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    doseAmount: row.dose_amount,
    doseUnit: row.dose_unit,
    scheduleTimes: row.schedule_times,
    notes: row.notes,
    active: row.active,
    notificationIds: row.notification_ids,
    createdAtMs: row.created_at_ms,
  };
}

export async function insertMedication(
  medication: NewMedication
): Promise<number> {
  const result = await supabase
    .from("medications")
    .insert({
      name: medication.name,
      type: medication.type,
      dose_amount: medication.doseAmount,
      dose_unit: medication.doseUnit,
      schedule_times: medication.scheduleTimes,
      notes: medication.notes,
      active: true,
      notification_ids: [],
    })
    .select("id")
    .single();
  return unwrap(result).id;
}

export async function updateMedicationNotificationIds(
  id: number,
  notificationIds: string[]
): Promise<void> {
  const { error } = await supabase
    .from("medications")
    .update({ notification_ids: notificationIds })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setMedicationActive(
  id: number,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("medications")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMedication(id: number): Promise<void> {
  const { error } = await supabase.from("medications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getActiveMedications(): Promise<Medication[]> {
  const result = await supabase
    .from("medications")
    .select("*")
    .eq("active", true)
    .order("created_at_ms", { ascending: false });
  return unwrap<MedicationRow[]>(result).map(mapMedicationRow);
}

export async function getAllMedications(): Promise<Medication[]> {
  const result = await supabase
    .from("medications")
    .select("*")
    .order("created_at_ms", { ascending: false });
  return unwrap<MedicationRow[]>(result).map(mapMedicationRow);
}

export async function insertMedicationLog(
  log: NewMedicationLog
): Promise<number> {
  const result = await supabase
    .from("medication_logs")
    .insert({
      medication_id: log.medicationId,
      taken_at_ms: log.takenAtMs,
      dose_amount: log.doseAmount,
      notes: log.notes,
    })
    .select("id")
    .single();
  return unwrap(result).id;
}

interface MedicationLogRow {
  id: number;
  medication_id: number;
  taken_at_ms: number;
  dose_amount: number | null;
  notes: string | null;
  created_at_ms: number;
}

export async function getMedicationLogsSince(
  sinceMs: number
): Promise<MedicationLog[]> {
  const result = await supabase
    .from("medication_logs")
    .select("*")
    .gte("taken_at_ms", sinceMs)
    .order("taken_at_ms", { ascending: false });
  return unwrap<MedicationLogRow[]>(result).map((row) => ({
    id: row.id,
    medicationId: row.medication_id,
    takenAtMs: row.taken_at_ms,
    doseAmount: row.dose_amount,
    notes: row.notes,
    createdAtMs: row.created_at_ms,
  }));
}

interface MealRow {
  id: number;
  timestamp_ms: number;
  description: string | null;
  calories: number | null;
  carbs_g: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  portion_estimate: string | null;
  items: MealItem[];
  source: "photo" | "manual";
  ai_notes: string | null;
  created_at_ms: number;
}

function mapMealRow(row: MealRow): Meal {
  return {
    id: row.id,
    timestampMs: row.timestamp_ms,
    description: row.description,
    calories: row.calories,
    carbsG: row.carbs_g,
    sugarG: row.sugar_g,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    portionEstimate: row.portion_estimate,
    items: row.items,
    source: row.source,
    aiNotes: row.ai_notes,
    createdAtMs: row.created_at_ms,
  };
}

export async function insertMeal(meal: NewMeal): Promise<number> {
  const result = await supabase
    .from("meals")
    .insert({
      timestamp_ms: meal.timestampMs,
      description: meal.description,
      calories: meal.calories,
      carbs_g: meal.carbsG,
      sugar_g: meal.sugarG,
      protein_g: meal.proteinG,
      fat_g: meal.fatG,
      portion_estimate: meal.portionEstimate,
      items: meal.items,
      source: meal.source,
      ai_notes: meal.aiNotes,
    })
    .select("id")
    .single();
  return unwrap(result).id;
}

export async function deleteMeal(id: number): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getMealsSince(sinceMs: number): Promise<Meal[]> {
  const result = await supabase
    .from("meals")
    .select("*")
    .gte("timestamp_ms", sinceMs)
    .order("timestamp_ms", { ascending: false });
  return unwrap<MealRow[]>(result).map(mapMealRow);
}

export function computeMealTotals(meals: Meal[]): MealTotals {
  return meals.reduce(
    (acc, m) => ({
      count: acc.count + 1,
      calories: acc.calories + (m.calories ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      sugarG: acc.sugarG + (m.sugarG ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { count: 0, calories: 0, carbsG: 0, sugarG: 0, proteinG: 0, fatG: 0 }
  );
}

// Base de conocimiento: compartida entre todos los pacientes, sin scoping por patient_id.
interface KnowledgeChunkRow {
  id: number;
  slug: string;
  title: string;
  authors: string;
  year: number | null;
  source: string;
  url: string | null;
  topic: string;
  text: string;
  embedding: number[];
  curated: boolean;
  created_at_ms: number;
}

function mapKnowledgeChunkRow(row: KnowledgeChunkRow): KnowledgeChunk {
  return {
    rowId: row.id,
    id: row.slug,
    title: row.title,
    authors: row.authors,
    year: row.year ?? 0,
    source: row.source,
    url: row.url,
    topic: row.topic as KnowledgeChunk["topic"],
    summary: row.text,
    embedding: row.embedding,
    curated: row.curated,
    createdAtMs: row.created_at_ms,
  };
}

export async function getKnowledgeChunkSlugs(): Promise<Set<string>> {
  const result = await supabase.from("knowledge_chunks").select("slug");
  return new Set(unwrap<{ slug: string }[]>(result).map((r) => r.slug));
}

export async function insertKnowledgeChunk(
  entry: KnowledgeCorpusEntry,
  embedding: number[],
  curated: boolean = true
): Promise<void> {
  const { error } = await supabase.from("knowledge_chunks").upsert(
    {
      slug: entry.id,
      title: entry.title,
      authors: entry.authors,
      year: entry.year,
      source: entry.source,
      url: entry.url,
      topic: entry.topic,
      text: entry.summary,
      embedding,
      curated,
    },
    { onConflict: "slug", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const result = await supabase.from("knowledge_chunks").select("*");
  return unwrap<KnowledgeChunkRow[]>(result).map(mapKnowledgeChunkRow);
}

export async function getKnowledgeChunkCount(): Promise<number> {
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function clearKnowledgeChunks(): Promise<void> {
  const { error } = await supabase.from("knowledge_chunks").delete().gt("id", -1);
  if (error) throw new Error(error.message);
}

export async function upsertLifestyleMetric(
  metric: NewLifestyleMetric
): Promise<void> {
  const { error } = await supabase.from("lifestyle_metrics").upsert(
    {
      date_key: metric.dateKey,
      date_ms: metric.dateMs,
      source: metric.source,
      sleep_score: metric.sleepScore,
      sleep_duration_min: metric.sleepDurationMin,
      hrv_ms: metric.hrvMs,
      resting_heart_rate: metric.restingHeartRate,
      recovery_index: metric.recoveryIndex,
      temp_deviation_c: metric.tempDeviationC,
      steps: metric.steps,
      vo2_max: metric.vo2Max,
      raw: metric.raw,
    },
    { onConflict: "patient_id,date_key,source" }
  );
  if (error) throw new Error(error.message);
}

interface LifestyleMetricRow {
  id: number;
  date_key: string;
  date_ms: number;
  source: LifestyleMetric["source"];
  sleep_score: number | null;
  sleep_duration_min: number | null;
  hrv_ms: number | null;
  resting_heart_rate: number | null;
  recovery_index: number | null;
  temp_deviation_c: number | null;
  steps: number | null;
  vo2_max: number | null;
  raw: string | null;
  created_at_ms: number;
}

export async function getLifestyleMetricsSince(
  sinceMs: number
): Promise<LifestyleMetric[]> {
  const result = await supabase
    .from("lifestyle_metrics")
    .select("*")
    .gte("date_ms", sinceMs)
    .order("date_ms", { ascending: false });
  return unwrap<LifestyleMetricRow[]>(result).map((row) => ({
    id: row.id,
    dateKey: row.date_key,
    dateMs: row.date_ms,
    source: row.source,
    sleepScore: row.sleep_score,
    sleepDurationMin: row.sleep_duration_min,
    hrvMs: row.hrv_ms,
    restingHeartRate: row.resting_heart_rate,
    recoveryIndex: row.recovery_index,
    tempDeviationC: row.temp_deviation_c,
    steps: row.steps,
    vo2Max: row.vo2_max,
    raw: row.raw,
    createdAtMs: row.created_at_ms,
  }));
}
