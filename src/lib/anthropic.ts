import * as SecureStore from "expo-secure-store";
import type {
  GlucoseUnit,
  KnowledgeSearchResult,
  MealItem,
  TrendArrow,
} from "../types";

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

async function callClaudeVision(
  base64Image: string,
  mediaType: string,
  promptText: string,
  maxTokens: number
): Promise<string> {
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
      max_tokens: maxTokens,
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
              text: promptText,
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
  return textBlock.text as string;
}

async function callClaudeText(
  promptText: string,
  maxTokens: number
): Promise<string> {
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
      max_tokens: maxTokens,
      messages: [{ role: "user", content: promptText }],
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
  return textBlock.text as string;
}

function extractJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA como JSON.");
  }
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
  const text = await callClaudeVision(base64Image, mediaType, EXTRACTION_PROMPT, 512);
  const parsed = extractJson(text);

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

export interface ClarificationAnswer {
  question: string;
  answer: string;
}

export interface ParsedMeal {
  items: MealItem[];
  calories: number | null;
  carbsG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  fatG: number | null;
  portionEstimate: string | null;
  confidence: "high" | "medium" | "low";
  clarifyingQuestions: string[];
  aiNotes: string | null;
}

function buildMealPrompt(
  additionalContext: string | null,
  clarifications: ClarificationAnswer[]
): string {
  let context = "";
  if (additionalContext) {
    context += `\nContexto adicional proporcionado por el usuario: "${additionalContext}"`;
  }
  if (clarifications.length > 0) {
    context += "\nAclaraciones adicionales del usuario:\n";
    context += clarifications
      .map((c) => `- ${c.question} → ${c.answer}`)
      .join("\n");
  }

  return `Eres un nutriólogo asistente para un paciente con diabetes tipo 1. Analiza la imagen de comida o bebida y devuelve ÚNICAMENTE un objeto JSON (sin texto adicional, sin markdown) con esta forma exacta:

{
  "items": [
    {
      "name": "<nombre del alimento/bebida>",
      "portionEstimate": "<estimación de la porción, ej. '1 taza (150g)'>",
      "calories": <número o null>,
      "carbsG": <número o null>,
      "sugarG": <número o null>,
      "proteinG": <número o null>,
      "fatG": <número o null>
    }
  ],
  "calories": <número total, suma de items>,
  "carbsG": <número total>,
  "sugarG": <número total>,
  "proteinG": <número total>,
  "fatG": <número total>,
  "portionEstimate": "<resumen breve de la porción total>",
  "confidence": "high" | "medium" | "low",
  "clarifyingQuestions": ["<pregunta corta que ayudaría a refinar la estimación>", ...],
  "aiNotes": "<observaciones relevantes para una persona con diabetes tipo 1, ej. alto índice glucémico, o null>"
}

Reglas:
- Identifica cada alimento o bebida visible por separado en "items".
- Estima porciones y macros usando tu conocimiento nutricional general; sé razonable y explícito sobre supuestos en "aiNotes".
- Presta especial atención a los carbohidratos y azúcares totales, ya que son críticos para el cálculo de insulina del paciente.
- Si hay ambigüedad real (tipo de pan, tamaño de porción, ingredientes ocultos como aceite o azúcar añadida), agrega hasta 3 preguntas cortas y concretas en "clarifyingQuestions". Si no hay ambigüedad relevante, deja la lista vacía.
- Si ya tienes contexto adicional o aclaraciones del usuario (abajo), incorpóralas en tu estimación final y dejarlas resueltas: no repitas la misma pregunta.
- No inventes datos que contradigan la imagen. Responde solo con el JSON.
${context}`;
}

export async function parseMealPhoto(
  base64Image: string,
  mediaType: string = "image/jpeg",
  additionalContext: string | null = null,
  clarifications: ClarificationAnswer[] = []
): Promise<ParsedMeal> {
  const prompt = buildMealPrompt(additionalContext, clarifications);
  const text = await callClaudeVision(base64Image, mediaType, prompt, 1024);
  const parsed = extractJson(text);

  if (!Array.isArray(parsed.items)) {
    throw new Error("La IA no pudo identificar alimentos en la imagen.");
  }

  return {
    items: parsed.items.map((item: any) => ({
      name: String(item.name ?? "Alimento"),
      portionEstimate: item.portionEstimate ?? null,
      calories: typeof item.calories === "number" ? item.calories : null,
      carbsG: typeof item.carbsG === "number" ? item.carbsG : null,
      sugarG: typeof item.sugarG === "number" ? item.sugarG : null,
      proteinG: typeof item.proteinG === "number" ? item.proteinG : null,
      fatG: typeof item.fatG === "number" ? item.fatG : null,
    })),
    calories: typeof parsed.calories === "number" ? parsed.calories : null,
    carbsG: typeof parsed.carbsG === "number" ? parsed.carbsG : null,
    sugarG: typeof parsed.sugarG === "number" ? parsed.sugarG : null,
    proteinG: typeof parsed.proteinG === "number" ? parsed.proteinG : null,
    fatG: typeof parsed.fatG === "number" ? parsed.fatG : null,
    portionEstimate: parsed.portionEstimate ?? null,
    confidence: parsed.confidence ?? "medium",
    clarifyingQuestions: Array.isArray(parsed.clarifyingQuestions)
      ? parsed.clarifyingQuestions.filter((q: unknown) => typeof q === "string")
      : [],
    aiNotes: parsed.aiNotes ?? null,
  };
}

export interface EvidenceSynthesis {
  etiology: string;
  management: string;
  likelyOutcome: string;
  evidenceStrength: "strong" | "moderate" | "limited";
  caveats: string | null;
}

function buildEvidenceSynthesisPrompt(
  query: string,
  chunks: KnowledgeSearchResult[]
): string {
  const sourcesBlock = chunks
    .map((c, i) => {
      const tag = c.curated ? "[curado]" : "[PubMed en vivo, NO revisado manualmente]";
      return `${i + 1}. ${tag} "${c.title}" — ${c.authors} (${c.year || "s/f"}), ${c.source}.\nResumen: ${c.summary}`;
    })
    .join("\n\n");

  return `Eres un asistente clínico que ayuda a un paciente con diabetes tipo 1 a entender un patrón que observó en sus propios registros (glucosa, comida, medicamentos, estilo de vida). Tienes disponibles los siguientes fragmentos de evidencia recuperados para su consulta. Algunos son de un corpus curado manualmente (guías ADA/ISPAD/ATTD y papers seleccionados); otros vienen de una búsqueda en vivo en PubMed y NO han sido revisados por un humano — trátalos con más cautela.

Patrón/consulta del paciente: "${query}"

Fragmentos de evidencia disponibles:
${sourcesBlock}

Devuelve ÚNICAMENTE un objeto JSON (sin texto adicional, sin markdown) con esta forma exacta:

{
  "etiology": "<explicación breve de posibles causas fisiológicas del patrón, basada SOLO en los fragmentos dados, citando autor/año entre paréntesis>",
  "management": "<puntos de manejo/estilo de vida a considerar y discutir con su equipo médico, basados en los fragmentos, citando autor/año>",
  "likelyOutcome": "<qué sugiere la evidencia sobre el resultado probable si el patrón continúa o si se aplican los ajustes discutidos, citando autor/año>",
  "evidenceStrength": "strong" | "moderate" | "limited",
  "caveats": "<advertencias sobre limitaciones de la evidencia, ej. estudios pequeños, fuentes no revisadas, o null si no aplica>"
}

Reglas estrictas:
- Basa cada afirmación SOLO en los fragmentos proporcionados. No inventes estudios ni cifras que no estén ahí.
- Si un fragmento es de PubMed en vivo (no revisado), dilo explícitamente al citarlo y refleja esa incertidumbre en "evidenceStrength" y "caveats".
- NUNCA prescribas una dosis exacta de insulina o medicamento. Enmarca "management" como temas y preguntas concretas para llevar al médico, no como instrucciones de tratamiento.
- Si la evidencia disponible es insuficiente para responder con confianza, dilo claramente en "caveats" en vez de rellenar con suposiciones.
- Responde en español, de forma clara y directa, sin jerga innecesaria.`;
}

export async function synthesizeEvidence(
  query: string,
  chunks: KnowledgeSearchResult[]
): Promise<EvidenceSynthesis> {
  if (chunks.length === 0) {
    throw new Error("No hay fragmentos de evidencia para sintetizar.");
  }
  const prompt = buildEvidenceSynthesisPrompt(query, chunks);
  const text = await callClaudeText(prompt, 1024);
  const parsed = extractJson(text);

  return {
    etiology: String(parsed.etiology ?? ""),
    management: String(parsed.management ?? ""),
    likelyOutcome: String(parsed.likelyOutcome ?? ""),
    evidenceStrength: parsed.evidenceStrength ?? "limited",
    caveats: parsed.caveats ?? null,
  };
}
