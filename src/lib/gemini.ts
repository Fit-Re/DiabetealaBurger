// Proveedor gratuito de embeddings: Google Gemini (tier gratis, sin billing).
// Reemplaza al proveedor de embeddings de pago anterior. Documentación usada:
//   https://ai.google.dev/gemini-api/docs/embeddings
// Auth: header `x-goog-api-key: <KEY>`. Modelo: gemini-embedding-001.
// Dimensión fijada a 768 (EMBEDDING_DIMENSIONS) para que todos los chunks y las
// queries sean comparables entre sí — mezclar dimensiones/modelos da similitudes
// basura, por eso al migrar hay que purgar y re-ingerir el corpus.
import * as SecureStore from "expo-secure-store";

const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key";
const EMBEDDING_MODEL = "gemini-embedding-001";

// Timeout de red por intento: sin esto, un fetch que se cuelga deja el spinner girando para siempre.
const REQUEST_TIMEOUT_MS = 60_000;
// Reintentos ante sobrecarga temporal del tier gratis (503), rate limit (429) o errores 5xx.
// Los errores no recuperables (400/401/403/404) fallan de inmediato, sin reintentar.
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Dimensión estable del vector de embeddings. El proveedor anterior producía
// 1024; Gemini es configurable — la fijamos en 768 (recomendada por la doc) y la
// exportamos para documentar la incompatibilidad con embeddings viejos.
export const EMBEDDING_DIMENSIONS = 768;

export async function getGeminiApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GEMINI_API_KEY_STORAGE_KEY);
}

export async function setGeminiApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(GEMINI_API_KEY_STORAGE_KEY, key.trim());
}

export async function clearGeminiApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(GEMINI_API_KEY_STORAGE_KEY);
}

// Alias neutral respecto al proveedor: autoEnrich lo usa para no acoplarse al
// nombre "Gemini" y poder cambiar de proveedor de embeddings sin tocarlo.
export const getEmbeddingApiKey = getGeminiApiKey;

export type EmbeddingInputType = "document" | "query";

// Mapea el tipo de entrada al taskType de Gemini: los documentos del corpus se
// indexan como RETRIEVAL_DOCUMENT y las consultas como RETRIEVAL_QUERY.
function taskTypeFor(inputType: EmbeddingInputType): string {
  return inputType === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";
}

export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType
): Promise<number[][]> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "No hay una API key de Gemini configurada. Agrégala en Ajustes."
    );
  }

  if (texts.length === 0) return [];

  const taskType = taskTypeFor(inputType);
  let lastError = "Error desconocido de Gemini.";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // Backoff exponencial con jitter: ~1s, 2s, 4s entre reintentos.
      await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            requests: texts.map((text) => ({
              model: `models/${EMBEDDING_MODEL}`,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: EMBEDDING_DIMENSIONS,
            })),
          }),
          signal: controller.signal,
        }
      );
    } catch (e: any) {
      clearTimeout(timeout);
      // Timeout o error de red: transitorios, reintentar.
      lastError =
        e?.name === "AbortError"
          ? `Gemini no respondió en ${REQUEST_TIMEOUT_MS / 1000}s.`
          : `Error de red al llamar a Gemini: ${e?.message ?? e}`;
      continue;
    }
    clearTimeout(timeout);

    if (response.ok) {
      const json = await response.json();
      if (!Array.isArray(json.embeddings)) {
        throw new Error("La respuesta de Gemini no tiene el formato esperado.");
      }
      // batchEmbedContents devuelve los embeddings en el MISMO orden de entrada.
      return json.embeddings.map((e: any) => e.values as number[]);
    }

    const errorText = await response.text();
    lastError = `Error de Gemini (${response.status}): ${errorText}`;
    // Errores no recuperables (clave inválida, modelo inexistente, request mal formado):
    // fallar de inmediato, no tiene sentido reintentar.
    if (!RETRYABLE_STATUS.has(response.status)) {
      throw new Error(lastError);
    }
    // Recuperable (503/429/5xx): el loop reintenta con backoff.
  }

  throw new Error(
    `Gemini está saturado ahora mismo (se reintentó ${MAX_ATTEMPTS} veces). ${lastError} Intenta de nuevo en un momento.`
  );
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get embedding for a single query string
 * Phase 3: Semantic search using query embeddings
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await embedTexts([query], "query");
  return embeddings[0];
}
