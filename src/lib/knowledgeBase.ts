import {
  getAllKnowledgeChunks,
  getKnowledgeChunkCount,
  getKnowledgeChunkSlugs,
  insertKnowledgeChunk,
  getPatientProfile,
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

// Phase 3: Patient preferences for personalized evidence discovery
export interface PatientPreferences {
  maxGraphDepth: 1 | 2 | 3;
  preferRctOnly: boolean;
  preferredEvidenceLevel: "rct" | "meta" | "observational";
  excludeTopics: string[];
  preferredLanguages: string[];
}

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

// ============================================================================
// Patient Personalization (Phase 3 Week 2)
// ============================================================================

/**
 * Load patient preferences from Supabase
 * Determines max graph depth, evidence filtering, topic exclusions
 */
export async function loadPatientPreferences(
  patientId: string
): Promise<PatientPreferences> {
  try {
    const { data } = await supabase
      .from("patient_preferences")
      .select("*")
      .eq("patient_id", patientId)
      .single();

    if (!data) {
      // Return defaults if no preferences configured
      return getDefaultPreferences();
    }

    return {
      maxGraphDepth: data.max_graph_depth as 1 | 2 | 3,
      preferRctOnly: data.prefer_rct_only ?? false,
      preferredEvidenceLevel: data.preferred_evidence_level ?? "rct",
      excludeTopics: data.exclude_topics ?? [],
      preferredLanguages: data.preferred_languages ?? ["es", "en"],
    };
  } catch {
    // If preferences table doesn't exist or query fails, return defaults
    return getDefaultPreferences();
  }
}

/**
 * Default preferences (middle ground for all patients)
 */
export function getDefaultPreferences(): PatientPreferences {
  return {
    maxGraphDepth: 2,
    preferRctOnly: false,
    preferredEvidenceLevel: "rct",
    excludeTopics: [],
    preferredLanguages: ["es", "en"],
  };
}

/**
 * Save patient preferences to Supabase
 */
export async function savePatientPreferences(
  patientId: string,
  preferences: PatientPreferences
): Promise<void> {
  try {
    const { error } = await supabase
      .from("patient_preferences")
      .upsert({
        patient_id: patientId,
        max_graph_depth: preferences.maxGraphDepth,
        prefer_rct_only: preferences.preferRctOnly,
        preferred_evidence_level: preferences.preferredEvidenceLevel,
        exclude_topics: preferences.excludeTopics,
        preferred_languages: preferences.preferredLanguages,
        updated_at: Date.now(),
      });

    if (error) {
      console.warn("Failed to save patient preferences:", error);
    }
  } catch {
    console.warn("Error saving patient preferences");
  }
}

/**
 * Search via graph with patient personalization
 * Uses patient's preferred depth, evidence level, and topic exclusions
 * Phase 3 Week 3: Also adjusts ranking based on feedback history
 */
export async function searchViaGraphPersonalized(
  query: string,
  patientId: string,
  patternCount: number = 1,
  avgSeverity: number = 1,
  topK: number = 5,
  patternId?: string  // Optional: for ranking adjustment with feedback
): Promise<ActivationResult[]> {
  if (!knowledgeGraphInstance) {
    console.warn("Knowledge graph not initialized");
    return [];
  }

  // Load patient preferences
  const preferences = await loadPatientPreferences(patientId);

  // Search with patient's preferred depth
  const results = await knowledgeGraphInstance.searchViaGraph(
    query,
    patternCount,
    avgSeverity,
    topK * 2  // Get extra results to filter
  );

  // Filter by patient preferences
  let filtered = results.filter((result) => {
    // Exclude topics if patient configured them
    if (
      preferences.excludeTopics.length > 0 &&
      result.paper.topics.some((t) => preferences.excludeTopics.includes(t))
    ) {
      return false;
    }

    // Filter by evidence level preference
    if (
      preferences.preferRctOnly &&
      result.paper.evidenceLevel !== "rct"
    ) {
      return false;
    }

    return true;
  });

  // Phase 3 Week 3: Adjust ranking based on feedback history
  if (patternId) {
    filtered = await rankResultsWithFeedback(filtered, patientId, patternId);
  }

  return filtered.slice(0, topK);
}

// ============================================================================
// Pattern Memory: Feedback Loop (Phase 3 Week 3)
// ============================================================================

/**
 * Record patient feedback about whether a paper was helpful
 */
export async function recordPatternFeedback(
  patientId: string,
  patternId: string,
  paperId: string,
  wasHelpful: boolean,
  actionTaken?: string,
  improvementScore?: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from("pattern_evidence_feedback")
      .upsert({
        patient_id: patientId,
        pattern_id: patternId,
        paper_id: paperId,
        was_helpful: wasHelpful,
        action_taken: actionTaken ?? null,
        improvement_score: improvementScore ?? null,
        rated_at: Date.now(),
      });

    if (error) {
      console.warn("Failed to record feedback:", error);
    } else {
      console.log(`✓ Feedback recorded: ${paperId} helpful=${wasHelpful}`);
    }
  } catch (e) {
    console.warn("Error recording feedback:", e);
  }
}

/**
 * Rank results with patient feedback history
 * Boosts papers that patient found helpful before
 */
async function rankResultsWithFeedback(
  results: ActivationResult[],
  patientId: string,
  patternId: string
): Promise<ActivationResult[]> {
  try {
    // Load feedback history for this patient
    const { data: feedbackRecords, error } = await supabase
      .from("pattern_evidence_feedback")
      .select("paper_id, was_helpful, improvement_score")
      .eq("patient_id", patientId)
      .in(
        "paper_id",
        results.map((r) => r.paperId)
      )
      .eq("was_helpful", true);  // Only consider helpful ratings

    if (error) {
      console.warn("Failed to load feedback:", error);
      return results;
    }

    if (!feedbackRecords || feedbackRecords.length === 0) {
      return results;  // No feedback history, return as-is
    }

    // Create feedback map for quick lookup
    const feedbackMap = new Map(
      feedbackRecords.map((f: any) => [
        f.paper_id,
        { helpful: f.was_helpful, score: f.improvement_score },
      ])
    );

    // Re-rank: boost papers patient found helpful
    const reranked = results
      .map((r) => {
        const feedback = feedbackMap.get(r.paperId);
        if (feedback?.helpful) {
          // Boost by 20% if patient marked as helpful
          r.activationScore *= 1.2;

          // Additional boost if improvement was observed
          if (feedback.score && feedback.score > 0) {
            r.activationScore *= 1 + feedback.score * 0.1;  // +10%/20% per score level
          }
        }
        return r;
      })
      .sort((a, b) => b.activationScore - a.activationScore);

    return reranked;
  } catch (e) {
    console.warn("Error ranking with feedback:", e);
    return results;  // Return unranked on error
  }
}

/**
 * Get feedback summary for a paper
 * Useful for showing "X% of patients found this helpful"
 */
export async function getPatientPaperFeedback(
  patientId: string,
  paperId: string
): Promise<{ wasHelpful: boolean | null; improvementScore: number | null } | null> {
  try {
    const { data, error } = await supabase
      .from("pattern_evidence_feedback")
      .select("was_helpful, improvement_score")
      .eq("patient_id", patientId)
      .eq("paper_id", paperId)
      .single();

    if (error?.code === "PGRST116") {
      return null;  // No feedback recorded
    }

    if (error) {
      console.warn("Error fetching feedback:", error);
      return null;
    }

    return {
      wasHelpful: data?.was_helpful ?? null,
      improvementScore: data?.improvement_score ?? null,
    };
  } catch (e) {
    console.warn("Error getting feedback:", e);
    return null;
  }
}
