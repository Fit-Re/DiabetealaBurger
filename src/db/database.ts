import * as SQLite from "expo-sqlite";
import type {
  GlucoseReading,
  NewGlucoseReading,
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
