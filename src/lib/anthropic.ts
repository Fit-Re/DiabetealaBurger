import * as SecureStore from "expo-secure-store";
import type { GlucoseUnit, TrendArrow } from "../types";

const API_KEY_STORAGE_KEY = "anthropic_api_key";
const MODEL = "claude-sonnet-5";

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

export interface ParsedLibreLinkReading {
  value: number;
  unit: GlucoseUnit;
  trend: TrendArrow;
  timestampMs: number | null;
  confidence: "high" | "medium" | "low";
  rawNote: string | null;
}

const EXTRACTION_PROMPT = `Eres un asistente que extrae datos de una captura de pantalla de la app LibreLink (sensor de glucosa FreeStyle Libre). Analiza la imagen y devuelve ÚNICAMENTE un objeto JSON (sin texto adicional, sin markdown) con esta forma exacta:

{
  "value": <número, el valor de glucosa mostrado>,
  "unit": "mg/dL" | "mmol/L",
  "trend": "rising_fast" | "rising" | "steady" | "falling" | "falling_fast" | null,
  "time": "<hora mostrada en la captura en formato HH:MM 24h, o null si no es visible>",
  "confidence": "high" | "medium" | "low",
  "rawNote": "<cualquier detalle relevante que veas, o null>"
}

Reglas:
- El valor de glucosa suele ser el número más grande y prominente en pantalla.
- La flecha de tendencia indica la dirección: doble flecha arriba = rising_fast, una flecha arriba = rising, flecha horizontal = steady, una flecha abajo = falling, doble flecha abajo = falling_fast.
- Si no puedes determinar algo con certeza, usa null en ese campo y baja el "confidence".
- No inventes valores. Responde solo con el JSON.`;

function combineTimeWithToday(time: string | null): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
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

export async function parseLibreLinkScreenshot(
  base64Image: string,
  mediaType: string = "image/jpeg"
): Promise<ParsedLibreLinkReading> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "No hay una API key de Anthropic configurada. Agrégala en Ajustes."
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Anthropic API (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const textBlock = json.content?.find((c: any) => c.type === "text");
  if (!textBlock?.text) {
    throw new Error("La respuesta de la API no contiene texto.");
  }

  let parsed: any;
  try {
    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA como JSON.");
  }

  if (typeof parsed.value !== "number") {
    throw new Error("La IA no pudo identificar un valor de glucosa en la imagen.");
  }

  return {
    value: parsed.value,
    unit: parsed.unit === "mmol/L" ? "mmol/L" : "mg/dL",
    trend: parsed.trend ?? null,
    timestampMs: combineTimeWithToday(parsed.time ?? null),
    confidence: parsed.confidence ?? "medium",
    rawNote: parsed.rawNote ?? null,
  };
}
