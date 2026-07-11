import {
  getAllKnowledgeChunks,
  getKnowledgeChunkCount,
  getKnowledgeChunkSlugs,
  insertKnowledgeChunk,
} from "../db/database";
import { KNOWLEDGE_CORPUS } from "../data/knowledgeCorpus";
import type { KnowledgeSearchResult } from "../types";
import { cosineSimilarity, embedTexts } from "./voyage";

const BATCH_SIZE = 10;

export interface IngestProgress {
  done: number;
  total: number;
}

export async function getIngestedCount(): Promise<number> {
  return getKnowledgeChunkCount();
}

export function getCorpusSize(): number {
  return KNOWLEDGE_CORPUS.length;
}

export async function ingestCorpus(
  onProgress?: (progress: IngestProgress) => void
): Promise<number> {
  const existingSlugs = await getKnowledgeChunkSlugs();
  const pending = KNOWLEDGE_CORPUS.filter((e) => !existingSlugs.has(e.id));

  let done = 0;
  onProgress?.({ done, total: pending.length });

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTexts(
      batch.map((e) => e.summary),
      "document"
    );
    for (let j = 0; j < batch.length; j++) {
      await insertKnowledgeChunk(batch[j], embeddings[j]);
    }
    done += batch.length;
    onProgress?.({ done, total: pending.length });
  }

  return pending.length;
}

export async function searchKnowledge(
  query: string,
  topK: number = 5
): Promise<KnowledgeSearchResult[]> {
  const chunks = await getAllKnowledgeChunks();
  if (chunks.length === 0) return [];

  const [queryEmbedding] = await embedTexts([query], "query");

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
