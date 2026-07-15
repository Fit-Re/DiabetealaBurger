import * as SecureStore from "expo-secure-store";
import { upsertLifestyleMetric } from "../db/database";
import { runBackgroundEnrichment } from "./autoEnrich";
import type { NewLifestyleMetric } from "../types";

// Cliente para el Personal API Token de Ultrahuman (generado en
// vision.ultrahuman.com/developer, no la API de terceros). Endpoint y forma
// de la respuesta confirmados contra datos reales el 12 jul 2026 —
// GET partner.ultrahuman.com/api/v1/partner/daily_metrics?date=,
// header Authorization: <token> (sin "Bearer"), respuesta
// data.metrics["YYYY-MM-DD"]: [{type, object}]. El campo `raw` se guarda
// completo en la DB por si Ultrahuman cambia el formato más adelante.
// IMPORTANTE: no mandar el parámetro `email` — con un Personal API Token el
// backend lo interpreta como "quiero ver los datos de otra cuenta" (el flujo
// de la API de partnership OAuth2) y responde 401 "User has not shared
// access!" porque no existe esa relación de conexión.

const TOKEN_KEY = "ultrahuman_token";

const BASE_URL = "https://partner.ultrahuman.com/api/v1";

export async function getStoredCredentials(): Promise<{
  token: string;
} | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  return { token };
}

export async function setStoredCredentials(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
}

export async function clearStoredCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

async function readJsonWithDiagnostics(response: Response): Promise<any> {
  const bodyText = await response.text();
  let json: any = {};
  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { _rawText: bodyText };
  }
  json._httpStatus = response.status;
  json._ok = response.ok;
  return json;
}

function describeError(json: any, fallbackLabel: string): string {
  const detail = json?.error || json?.message || json?._rawText;
  const status = json?._httpStatus;
  if (detail) return `${fallbackLabel} (${status}): ${detail}`;
  return `${fallbackLabel} (${status}). Ultrahuman no dio más detalle en la respuesta.`;
}

export async function fetchMetricsForDate(
  token: string,
  dateKey: string
): Promise<any> {
  const url = `${BASE_URL}/partner/daily_metrics?date=${dateKey}`;
  const response = await fetch(url, {
    headers: {
      Authorization: token,
      "content-type": "application/json",
    },
  });
  const json = await readJsonWithDiagnostics(response);
  if (!response.ok || json?.error) {
    throw new Error(describeError(json, "Error al obtener métricas de Ultrahuman"));
  }
  return json;
}

interface MetricDataEntry {
  type?: string;
  object?: any;
}

function findMetricObject(
  metricData: MetricDataEntry[],
  typeNames: string[]
): any | null {
  const found = metricData.find(
    (m) => typeof m?.type === "string" && typeNames.includes(m.type.toLowerCase())
  );
  return found?.object ?? null;
}

function findNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && !Number.isNaN(value)) return value;
  }
  return null;
}

export interface NormalizedMetrics {
  sleepScore: number | null;
  sleepDurationMin: number | null;
  hrvMs: number | null;
  restingHeartRate: number | null;
  recoveryIndex: number | null;
  tempDeviationC: number | null;
  steps: number | null;
  vo2Max: number | null;
}

// Confirmado con una respuesta real (12 jul 2026): data.metrics es un objeto
// indexado por fecha ("YYYY-MM-DD" -> [{type, object}]), no un array plano
// como asumía la primera versión. La mayoría de las métricas puntuales
// (recovery_index, vo2_max, sleep_rhr, movement_index) vienen como
// {value, title, day_start_timestamp}; sueño viene en un objeto grande con
// sus propios sub-campos (sleep_score.score, total_sleep.minutes,
// temperature_deviation.celsius, etc).
export function normalizeMetrics(raw: any, dateKey: string): NormalizedMetrics {
  const metricData: MetricDataEntry[] = Array.isArray(raw?.data?.metrics?.[dateKey])
    ? raw.data.metrics[dateKey]
    : [];

  const sleep = findMetricObject(metricData, ["sleep"]);
  const avgSleepHrv = findMetricObject(metricData, ["avg_sleep_hrv"]);
  const hrv = findMetricObject(metricData, ["hrv"]);
  const sleepRhr = findMetricObject(metricData, ["sleep_rhr"]);
  const nightRhr = findMetricObject(metricData, ["night_rhr"]);
  const recovery = findMetricObject(metricData, ["recovery_index"]);
  const steps = findMetricObject(metricData, ["steps"]);
  const vo2 = findMetricObject(metricData, ["vo2_max"]);

  return {
    sleepScore: findNumber(sleep?.sleep_score, ["score"]),
    sleepDurationMin: findNumber(sleep?.total_sleep, ["minutes"]),
    hrvMs:
      findNumber(avgSleepHrv, ["value"]) ?? findNumber(hrv, ["avg", "value"]),
    restingHeartRate:
      findNumber(sleepRhr, ["value"]) ?? findNumber(nightRhr, ["avg", "value"]),
    recoveryIndex: findNumber(recovery, ["value"]),
    tempDeviationC: findNumber(sleep?.temperature_deviation, ["celsius"]),
    steps: findNumber(steps, ["total", "value"]),
    vo2Max: findNumber(vo2, ["value"]),
  };
}

export interface SyncResult {
  daysAttempted: number;
  daysImported: number;
  errors: string[];
}

export async function syncUltrahuman(daysBack: number = 7): Promise<SyncResult> {
  const creds = await getStoredCredentials();
  if (!creds) {
    throw new Error(
      "No hay token de Ultrahuman configurado. Agrégalo en Ajustes."
    );
  }

  const errors: string[] = [];
  let daysImported = 0;

  for (let i = 0; i < daysBack; i++) {
    const dateKey = dateKeyDaysAgo(i);
    try {
      const raw = await fetchMetricsForDate(creds.token, dateKey);
      const normalized = normalizeMetrics(raw, dateKey);
      const metric: NewLifestyleMetric = {
        dateKey,
        dateMs: dateKeyToMs(dateKey),
        source: "ultrahuman",
        ...normalized,
        raw: JSON.stringify(raw),
      };
      await upsertLifestyleMetric(metric);
      daysImported++;
    } catch (e: any) {
      errors.push(`${dateKey}: ${e?.message ?? "error desconocido"}`);
    }
  }

  if (daysImported > 0) runBackgroundEnrichment();

  return { daysAttempted: daysBack, daysImported, errors };
}
