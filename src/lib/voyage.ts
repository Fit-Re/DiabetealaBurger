import * as SecureStore from "expo-secure-store";

const VOYAGE_API_KEY_STORAGE_KEY = "voyage_api_key";
const EMBEDDING_MODEL = "voyage-3.5";

export async function getVoyageApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(VOYAGE_API_KEY_STORAGE_KEY);
}

export async function setVoyageApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(VOYAGE_API_KEY_STORAGE_KEY, key.trim());
}

export async function clearVoyageApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(VOYAGE_API_KEY_STORAGE_KEY);
}

export type EmbeddingInputType = "document" | "query";

export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType
): Promise<number[][]> {
  const apiKey = await getVoyageApiKey();
  if (!apiKey) {
    throw new Error(
      "No hay una API key de Voyage AI configurada. Agrégala en Ajustes."
    );
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Voyage AI (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (!Array.isArray(json.data)) {
    throw new Error("La respuesta de Voyage AI no tiene el formato esperado.");
  }
  return json.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding as number[]);
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
