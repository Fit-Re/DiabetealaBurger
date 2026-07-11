import {
  getAllKnowledgeChunks,
  getKnowledgeChunkCount,
  getKnowledgeChunkSlugs,
  insertKnowledgeChunk,
} from "../db/database";
import { KNOWLEDGE_CORPUS } from "../data/knowledgeCorpus";
import { searchPubMedLive } from "./pubmed";
import type { KnowledgeSearchResult } from "../types";
import { cosineSimilarity, embedTexts } from "./voyage";

const BATCH_SIZE = 10;
const LIVE_FALLBACK_SCORE_THRESHOLD = 0.55;
const LIVE_FALLBACK_MAX_RESULTS = 3;
const LIVE_SUMMARY_MAX_CHARS = 800;

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
      await insertKnowledgeChunk(batch[j], embeddings[j], true);
    }
    done += batch.length;
    onProgress?.({ done, total: pending.length });
  }

  return pending.length;
}

async function fetchLiveResults(query: string): Promise<KnowledgeSearchResult[]> {
  const articles = await searchPubMedLive(query, LIVE_FALLBACK_MAX_RESULTS);
  if (articles.length === 0) return [];

  const summaries = articles.map((a) => a.abstract.slice(0, LIVE_SUMMARY_MAX_CHARS));
  const [queryEmbedding, ...articleEmbeddings] = await embedTexts(
    [query, ...summaries],
    "query"
  );

  const results: KnowledgeSearchResult[] = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const embedding = articleEmbeddings[i];
    const entry = {
      id: `pubmed-${article.pmid}`,
      title: article.title,
      authors: article.authors,
      year: article.year ?? 0,
      source: article.journal || "PubMed",
      url: article.url,
      topic: "general" as const,
      summary: summaries[i],
    };
    await insertKnowledgeChunk(entry, embedding, false);
    results.push({
      ...entry,
      rowId: -1,
      embedding,
      curated: false,
      createdAtMs: Date.now(),
      score: cosineSimilarity(queryEmbedding, embedding),
    });
  }
  return results;
}

export interface SearchKnowledgeOptions {
  topK?: number;
  allowLiveFallback?: boolean;
}

export async function searchKnowledge(
  query: string,
  options: SearchKnowledgeOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const { topK = 5, allowLiveFallback = true } = options;

  const chunks = await getAllKnowledgeChunks();
  const [queryEmbedding] = await embedTexts([query], "query");

  let localResults: KnowledgeSearchResult[] = chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  const topScore = localResults[0]?.score ?? 0;
  const needsLiveFallback =
    allowLiveFallback && topScore < LIVE_FALLBACK_SCORE_THRESHOLD;

  if (needsLiveFallback) {
    try {
      const liveResults = await fetchLiveResults(query);
      localResults = [...localResults, ...liveResults].sort(
        (a, b) => b.score - a.score
      );
    } catch {
      // Si falla la búsqueda en vivo (sin conexión, PubMed caído, etc.),
      // seguimos con los resultados locales que ya tenemos.
    }
  }

  return localResults.slice(0, topK);
}
