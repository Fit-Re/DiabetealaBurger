import * as SQLite from "expo-sqlite";
import type {
  GlucoseReading,
  KnowledgeChunk,
  KnowledgeCorpusEntry,
  Meal,
  MealItem,
  MealTotals,
  Medication,
  MedicationLog,
  MedicationType,
  NewGlucoseReading,
  NewMeal,
  NewMedication,
  NewMedicationLog,
  RangeStats,
} from "../types";
import { TARGET_RANGE } from "../types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("glucotrack.db");
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS glucose_readings (
      id INTEGER PRIMARY KEY NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      timestampMs INTEGER NOT NULL,
      source TEXT NOT NULL,
      trend TEXT,
      notes TEXT,
      createdAtMs INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON glucose_readings (timestampMs);

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      doseAmount REAL,
      doseUnit TEXT,
      scheduleTimes TEXT NOT NULL,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      notificationIds TEXT NOT NULL DEFAULT '[]',
      createdAtMs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medication_logs (
      id INTEGER PRIMARY KEY NOT NULL,
      medicationId INTEGER NOT NULL,
      takenAtMs INTEGER NOT NULL,
      doseAmount REAL,
      notes TEXT,
      createdAtMs INTEGER NOT NULL,
      FOREIGN KEY (medicationId) REFERENCES medications (id)
    );
    CREATE INDEX IF NOT EXISTS idx_medication_logs_taken ON medication_logs (takenAtMs);

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY NOT NULL,
      timestampMs INTEGER NOT NULL,
      description TEXT,
      calories REAL,
      carbsG REAL,
      sugarG REAL,
      proteinG REAL,
      fatG REAL,
      portionEstimate TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL,
      aiNotes TEXT,
      createdAtMs INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals (timestampMs);

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      year INTEGER,
      source TEXT NOT NULL,
      url TEXT,
      topic TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      curated INTEGER NOT NULL DEFAULT 1,
      createdAtMs INTEGER NOT NULL
    );
  `);
}

export async function insertReading(
  reading: NewGlucoseReading
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO glucose_readings (value, unit, timestampMs, source, trend, notes, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      reading.value,
      reading.unit,
      reading.timestampMs,
      reading.source,
      reading.trend,
      reading.notes,
      Date.now(),
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteReading(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM glucose_readings WHERE id = ?`, [id]);
}

export async function getReadingsSince(
  sinceMs: number
): Promise<GlucoseReading[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GlucoseReading>(
    `SELECT * FROM glucose_readings WHERE timestampMs >= ? ORDER BY timestampMs DESC`,
    [sinceMs]
  );
  return rows;
}

export async function getRecentReadings(
  limit: number = 20
): Promise<GlucoseReading[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GlucoseReading>(
    `SELECT * FROM glucose_readings ORDER BY timestampMs DESC LIMIT ?`,
    [limit]
  );
  return rows;
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
  doseAmount: number | null;
  doseUnit: string | null;
  scheduleTimes: string;
  notes: string | null;
  active: number;
  notificationIds: string;
  createdAtMs: number;
}

function mapMedicationRow(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    doseAmount: row.doseAmount,
    doseUnit: row.doseUnit,
    scheduleTimes: JSON.parse(row.scheduleTimes),
    notes: row.notes,
    active: row.active === 1,
    notificationIds: JSON.parse(row.notificationIds),
    createdAtMs: row.createdAtMs,
  };
}

export async function insertMedication(
  medication: NewMedication
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO medications (name, type, doseAmount, doseUnit, scheduleTimes, notes, active, notificationIds, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, 1, '[]', ?)`,
    [
      medication.name,
      medication.type,
      medication.doseAmount,
      medication.doseUnit,
      JSON.stringify(medication.scheduleTimes),
      medication.notes,
      Date.now(),
    ]
  );
  return result.lastInsertRowId;
}

export async function updateMedicationNotificationIds(
  id: number,
  notificationIds: string[]
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET notificationIds = ? WHERE id = ?`,
    [JSON.stringify(notificationIds), id]
  );
}

export async function setMedicationActive(
  id: number,
  active: boolean
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE medications SET active = ? WHERE id = ?`, [
    active ? 1 : 0,
    id,
  ]);
}

export async function deleteMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM medication_logs WHERE medicationId = ?`, [id]);
  await db.runAsync(`DELETE FROM medications WHERE id = ?`, [id]);
}

export async function getActiveMedications(): Promise<Medication[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationRow>(
    `SELECT * FROM medications WHERE active = 1 ORDER BY createdAtMs DESC`
  );
  return rows.map(mapMedicationRow);
}

export async function getAllMedications(): Promise<Medication[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationRow>(
    `SELECT * FROM medications ORDER BY createdAtMs DESC`
  );
  return rows.map(mapMedicationRow);
}

export async function insertMedicationLog(
  log: NewMedicationLog
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO medication_logs (medicationId, takenAtMs, doseAmount, notes, createdAtMs)
     VALUES (?, ?, ?, ?, ?)`,
    [log.medicationId, log.takenAtMs, log.doseAmount, log.notes, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function getMedicationLogsSince(
  sinceMs: number
): Promise<MedicationLog[]> {
  const db = await getDb();
  return db.getAllAsync<MedicationLog>(
    `SELECT * FROM medication_logs WHERE takenAtMs >= ? ORDER BY takenAtMs DESC`,
    [sinceMs]
  );
}

interface MealRow {
  id: number;
  timestampMs: number;
  description: string | null;
  calories: number | null;
  carbsG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  fatG: number | null;
  portionEstimate: string | null;
  items: string;
  source: "photo" | "manual";
  aiNotes: string | null;
  createdAtMs: number;
}

function mapMealRow(row: MealRow): Meal {
  return {
    id: row.id,
    timestampMs: row.timestampMs,
    description: row.description,
    calories: row.calories,
    carbsG: row.carbsG,
    sugarG: row.sugarG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    portionEstimate: row.portionEstimate,
    items: JSON.parse(row.items) as MealItem[],
    source: row.source,
    aiNotes: row.aiNotes,
    createdAtMs: row.createdAtMs,
  };
}

export async function insertMeal(meal: NewMeal): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO meals (timestampMs, description, calories, carbsG, sugarG, proteinG, fatG, portionEstimate, items, source, aiNotes, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meal.timestampMs,
      meal.description,
      meal.calories,
      meal.carbsG,
      meal.sugarG,
      meal.proteinG,
      meal.fatG,
      meal.portionEstimate,
      JSON.stringify(meal.items),
      meal.source,
      meal.aiNotes,
      Date.now(),
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM meals WHERE id = ?`, [id]);
}

export async function getMealsSince(sinceMs: number): Promise<Meal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MealRow>(
    `SELECT * FROM meals WHERE timestampMs >= ? ORDER BY timestampMs DESC`,
    [sinceMs]
  );
  return rows.map(mapMealRow);
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
  embedding: string;
  curated: number;
  createdAtMs: number;
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
    embedding: JSON.parse(row.embedding),
    curated: row.curated === 1,
    createdAtMs: row.createdAtMs,
  };
}

export async function getKnowledgeChunkSlugs(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ slug: string }>(
    `SELECT slug FROM knowledge_chunks`
  );
  return new Set(rows.map((r) => r.slug));
}

export async function insertKnowledgeChunk(
  entry: KnowledgeCorpusEntry,
  embedding: number[],
  curated: boolean = true
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO knowledge_chunks (slug, title, authors, year, source, url, topic, text, embedding, curated, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.title,
      entry.authors,
      entry.year,
      entry.source,
      entry.url,
      entry.topic,
      entry.summary,
      JSON.stringify(embedding),
      curated ? 1 : 0,
      Date.now(),
    ]
  );
}

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<KnowledgeChunkRow>(
    `SELECT * FROM knowledge_chunks`
  );
  return rows.map(mapKnowledgeChunkRow);
}

export async function getKnowledgeChunkCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM knowledge_chunks`
  );
  return row?.count ?? 0;
}

export async function clearKnowledgeChunks(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM knowledge_chunks`);
}
