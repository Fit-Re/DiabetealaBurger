import * as SecureStore from "expo-secure-store";
import type { TrendArrow } from "../types";
import { postWithRetry } from "./fetchWithRetry";

// Cliente para OCR.space (https://ocr.space/ocrapi) — API de OCR gratuita
// (tier gratis: 25,000 peticiones/mes, sin tarjeta de crédito, solo registro
// por email en ocr.space/ocrapi/freekey). Alternativa para leer capturas de
// LibreLink sin usar la IA de visión (Gemini): no "entiende" la imagen como
// una IA de visión, solo lee texto — así que la flecha de tendencia (es un
// ícono, no texto) no se detecta y hay que confirmarla a mano, pero el valor
// numérico y la hora sí se extraen solos.
//
// Heurística: LibreLink muestra el valor de glucosa como el número más
// grande y prominente en pantalla. Pedimos el overlay de texto (con alto de
// cada palabra) y nos quedamos con el número, dentro del rango plausible de
// un sensor Libre (40-500 mg/dL), con mayor altura de letra — mismo enfoque
// defensivo que usamos con los campos de Ultrahuman cuando no hay
// documentación oficial exacta del formato.

const API_KEY_STORAGE_KEY = "ocrspace_api_key";
const OCR_ENDPOINT = "https://api.ocr.space/parse/image";

const MIN_PLAUSIBLE_MGDL = 40;
const MAX_PLAUSIBLE_MGDL = 500;
const HIGH_CONFIDENCE_HEIGHT_RATIO = 1.3;

export async function getOcrApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}

export async function setOcrApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
}

export async function clearOcrApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

interface OcrWord {
  WordText: string;
  Height: number;
}

interface OcrLine {
  Words: OcrWord[];
}

async function callOcrSpace(base64Image: string, mediaType: string): Promise<any> {
  const apiKey = await getOcrApiKey();
  if (!apiKey) {
    throw new Error(
      "No hay una API key de OCR.space configurada. Es gratis (sin tarjeta): regístrate en ocr.space/ocrapi/freekey y agrégala en Ajustes."
    );
  }

  const body = new URLSearchParams({
    apikey: apiKey,
    base64Image: `data:${mediaType};base64,${base64Image}`,
    isOverlayRequired: "true",
    scale: "true",
    OCREngine: "2",
    language: "spa",
  });

  const response = await postWithRetry(
    OCR_ENDPOINT,
    body.toString(),
    { "content-type": "application/x-www-form-urlencoded" }
  );

  if (!response.ok) {
    throw new Error(`Error de OCR.space (${response.status})`);
  }
  const json = await response.json();
  if (json.IsErroredOnProcessing) {
    const message = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join(" ")
      : json.ErrorMessage;
    throw new Error(message || "OCR.space no pudo procesar la imagen.");
  }
  return json;
}

interface GlucoseCandidate {
  value: number;
  height: number;
}

function findGlucoseCandidates(json: any): GlucoseCandidate[] {
  const lines: OcrLine[] = json?.ParsedResults?.[0]?.TextOverlay?.Lines ?? [];
  const candidates: GlucoseCandidate[] = [];

  for (const line of lines) {
    for (const word of line.Words ?? []) {
      const text = (word.WordText ?? "").trim();
      if (!/^\d{2,3}$/.test(text)) continue;
      const numeric = Number(text);
      if (numeric < MIN_PLAUSIBLE_MGDL || numeric > MAX_PLAUSIBLE_MGDL) continue;
      candidates.push({ value: numeric, height: word.Height ?? 0 });
    }
  }

  return candidates.sort((a, b) => b.height - a.height);
}

function findTimeInText(text: string): number | null {
  const match = /([01]?\d|2[0-3]):([0-5]\d)/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const now = new Date();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate.getTime();
}

export interface OcrLibreLinkReading {
  value: number;
  trend: TrendArrow;
  timestampMs: number | null;
  confidence: "high" | "medium" | "low";
  rawNote: string | null;
}

export async function parseLibreLinkScreenshotOCR(
  base64Image: string,
  mediaType: string = "image/jpeg"
): Promise<OcrLibreLinkReading> {
  const json = await callOcrSpace(base64Image, mediaType);
  const fullText: string = json?.ParsedResults?.[0]?.ParsedText ?? "";
  const candidates = findGlucoseCandidates(json);

  if (candidates.length === 0) {
    throw new Error(
      "No se pudo identificar un número de glucosa claro en la imagen. Prueba con una captura más nítida y completa, o ingresa el valor a mano."
    );
  }

  const top = candidates[0];
  const runnerUp = candidates[1];
  const confidence: "high" | "medium" =
    !runnerUp || top.height > runnerUp.height * HIGH_CONFIDENCE_HEIGHT_RATIO
      ? "high"
      : "medium";

  return {
    value: top.value,
    trend: null,
    timestampMs: findTimeInText(fullText),
    confidence,
    rawNote:
      "Extraído por OCR (OCR.space) — el OCR no detecta la flecha de tendencia, confírmala a mano.",
  };
}
