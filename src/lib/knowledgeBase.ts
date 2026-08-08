import {
  getAllKnowledgeChunks,
  getKnowledgeChunkCount,
  getKnowledgeChunkSlugs,
  insertKnowledgeChunk,
} from "../db/database";
import { KNOWLEDGE_CORPUS } from "../data/knowledgeCorpus";
import { searchPubMedLive } from "./pubmed";
import type { KnowledgeSearchResult } from "../types";
import { cosineSimilarity, embedTexts } from "./gemini";
import { KnowledgeGraph, type PaperNode, type ActivationResult, type PaperEdge, type EdgeType } from "./knowledgeGraph";
import { supabase } from "./supabase";

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

// ============================================================================
// Knowledge Graph Integration (Phase 1)
// ============================================================================

let knowledgeGraphInstance: KnowledgeGraph | null = null;

/**
 * Initialize the knowledge graph with papers and relationships
 * Call this once at app startup
 */
export async function initializeKnowledgeGraph(): Promise<void> {
  if (knowledgeGraphInstance) return;  // Already initialized

  const graph = new KnowledgeGraph();
  const chunks = await getAllKnowledgeChunks();

  // Convert chunks to PaperNode format
  const papers: PaperNode[] = chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    authors: chunk.authors,
    year: chunk.year,
    source: chunk.source,
    url: chunk.url,
    topics: chunk.topic ? [chunk.topic] : [],
    evidenceLevel: "observational" as const,  // Default; could be enhanced
    sampleSize: null,
    embedding: chunk.embedding,
    curated: chunk.curated,
    summary: chunk.summary,
  }));

  // Load paper relationships from Supabase
  const { data: relations, error } = await supabase
    .from("paper_relationships")
    .select("paper_id_a, paper_id_b, edge_type, weight, reasoning");

  const edges: PaperEdge[] = [];
  if (!error && relations) {
    edges.push(
      ...relations.map((r: any) => ({
        sourcePaperId: r.paper_id_a,
        targetPaperId: r.paper_id_b,
        edgeType: r.edge_type as EdgeType,
        weight: r.weight,
        reasoning: r.reasoning || "",
      }))
    );
  }

  graph.loadGraph(papers, edges);
  knowledgeGraphInstance = graph;
  console.log(
    `✓ Knowledge graph initialized with ${papers.length} papers, ${edges.length} edges`
  );
}

/**
 * Get the knowledge graph instance
 */
export function getKnowledgeGraph(): KnowledgeGraph | null {
  return knowledgeGraphInstance;
}

/**
 * Search via knowledge graph: semantic search + multi-hop propagation
 * Returns papers ranked by activation score, showing activation paths
 *
 * @param query Search query
 * @param patternCount Number of detected patterns (affects propagation depth)
 * @param avgSeverity Average pattern severity 0-1 (affects propagation depth)
 * @param topK Number of results to return
 * @returns Ranked papers with activation paths and confidence
 */
export async function searchViaGraph(
  query: string,
  patternCount: number = 1,
  avgSeverity: number = 1,
  topK: number = 5
): Promise<ActivationResult[]> {
  if (!knowledgeGraphInstance) {
    console.warn("Knowledge graph not initialized; falling back to linear search");
    const linear = await searchKnowledge(query, { topK });
    return linear.map((r) => ({
      paperId: r.id,
      paper: {
        id: r.id,
        title: r.title,
        authors: r.authors,
        year: r.year,
        source: r.source,
        url: r.url,
        topics: r.topic ? [r.topic] : [],
        evidenceLevel: "observational" as const,
        sampleSize: null,
        embedding: r.embedding,
        curated: r.curated,
        summary: r.summary,
      },
      activationScore: r.score,
      path: [r.id],
      hopCount: 0,
      confidence: r.score > 0.7 ? ("strong" as const) : ("moderate" as const),
    }));
  }

  // Use graph-based search with semantic embeddings (Phase 3)
  return await knowledgeGraphInstance.searchViaGraph(query, patternCount, avgSeverity, topK);
}

/**
 * Compute case complexity based on patterns (for adaptive propagation depth)
 */
export function computePatternComplexity(
  patternCount: number,
  severities: ("info" | "watch" | "attention")[]
): { complexity: number; depth: number } {
  const severityScores: number[] = severities.map((s) => {
    switch (s) {
      case "info": return 0.3;
      case "watch": return 0.6;
      case "attention": return 1.0;
      default: return 0.5;
    }
  });

  const avgSeverity: number = severityScores.length > 0
    ? severityScores.reduce((a, b) => a + b) / severityScores.length
    : 0.5;

  if (!knowledgeGraphInstance) {
    return { complexity: 1, depth: 1 };
  }

  const complexity = knowledgeGraphInstance.computeCaseComplexity(
    patternCount,
    avgSeverity
  );
  const depth = knowledgeGraphInstance.determinePropagationDepth(complexity);

  return { complexity, depth };
}
