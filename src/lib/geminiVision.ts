// Visión + generación con salida JSON: Google Gemini Flash (tier gratis, sin
// billing). Reemplaza al proveedor de IA de pago anterior para las tres tareas:
// lectura de capturas de LibreLink, análisis de fotos de comida y síntesis de
// evidencia clínica. Documentación de referencia usada:
//   https://ai.google.dev/api/generate-content
// Auth: header `x-goog-api-key: <KEY>`. Modelo: gemini-2.5-flash.
// La API key es la MISMA de embeddings (una sola key de Gemini para toda la app),
// por eso se reutiliza getGeminiApiKey de ./gemini.
import type {
  GlucoseUnit,
  KnowledgeSearchResult,
  MealItem,
  TrendArrow,
} from "../types";
import { getGeminiApiKey } from "./gemini";

const MODEL = "gemini-2.5-flash";

async function callGemini(
  parts: any[],
  responseSchema?: object
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "No hay una API key de Gemini configurada. Agrégala en Ajustes."
    );
  }

  const body: any = {
    contents: [{ role: "user", parts }],
  };
  if (responseSchema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema,
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Gemini (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("La respuesta de la API no contiene texto.");
  }
  return text as string;
}

// Visión + JSON estructurado: envía la imagen inline y pide salida conforme a un
// responseSchema (JSON Schema estándar).
async function callGeminiVisionJson(
  base64Image: string,
  mimeType: string,
  promptText: string,
  responseSchema: object
): Promise<any> {
  const text = await callGemini(
    [
      { text: promptText },
      { inline_data: { mime_type: mimeType, data: base64Image } },
    ],
    responseSchema
  );
  return extractJson(text);
}

// Texto + JSON estructurado (sin imagen).
async function callGeminiTextJson(
  promptText: string,
  responseSchema: object
): Promise<any> {
  const text = await callGemini([{ text: promptText }], responseSchema);
  return extractJson(text);
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

const LIBRELINK_SCHEMA = {
  type: "object",
  properties: {
    value: { type: "number" },
    unit: { type: "string", enum: ["mg/dL", "mmol/L"] },
    trend: {
      type: "string",
      enum: ["rising_fast", "rising", "steady", "falling", "falling_fast"],
      nullable: true,
    },
    time: { type: "string", nullable: true },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rawNote: { type: "string", nullable: true },
  },
  required: ["value", "unit", "confidence"],
};

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
  const parsed = await callGeminiVisionJson(
    base64Image,
    mediaType,
    EXTRACTION_PROMPT,
    LIBRELINK_SCHEMA
  );

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

const MEAL_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    portionEstimate: { type: "string", nullable: true },
    calories: { type: "number", nullable: true },
    carbsG: { type: "number", nullable: true },
    sugarG: { type: "number", nullable: true },
    proteinG: { type: "number", nullable: true },
    fatG: { type: "number", nullable: true },
  },
  required: ["name"],
};

const MEAL_SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: MEAL_ITEM_SCHEMA },
    calories: { type: "number", nullable: true },
    carbsG: { type: "number", nullable: true },
    sugarG: { type: "number", nullable: true },
    proteinG: { type: "number", nullable: true },
    fatG: { type: "number", nullable: true },
    portionEstimate: { type: "string", nullable: true },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    clarifyingQuestions: { type: "array", items: { type: "string" } },
    aiNotes: { type: "string", nullable: true },
  },
  required: ["items"],
};

export async function parseMealPhoto(
  base64Image: string,
  mediaType: string = "image/jpeg",
  additionalContext: string | null = null,
  clarifications: ClarificationAnswer[] = []
): Promise<ParsedMeal> {
  const prompt = buildMealPrompt(additionalContext, clarifications);
  const parsed = await callGeminiVisionJson(
    base64Image,
    mediaType,
    prompt,
    MEAL_SCHEMA
  );

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

const EVIDENCE_SCHEMA = {
  type: "object",
  properties: {
    etiology: { type: "string" },
    management: { type: "string" },
    likelyOutcome: { type: "string" },
    evidenceStrength: { type: "string", enum: ["strong", "moderate", "limited"] },
    caveats: { type: "string", nullable: true },
  },
  required: ["etiology", "management", "likelyOutcome", "evidenceStrength"],
};

export async function synthesizeEvidence(
  query: string,
  chunks: KnowledgeSearchResult[]
): Promise<EvidenceSynthesis> {
  if (chunks.length === 0) {
    throw new Error("No hay fragmentos de evidencia para sintetizar.");
  }
  const prompt = buildEvidenceSynthesisPrompt(query, chunks);
  const parsed = await callGeminiTextJson(prompt, EVIDENCE_SCHEMA);

  return {
    etiology: String(parsed.etiology ?? ""),
    management: String(parsed.management ?? ""),
    likelyOutcome: String(parsed.likelyOutcome ?? ""),
    evidenceStrength: parsed.evidenceStrength ?? "limited",
    caveats: parsed.caveats ?? null,
  };
}
