/**
 * Knowledge Neural Network — Graph-based paper correlation & activation
 *
 * This module implements a neural-network-style knowledge graph where:
 * - Papers are nodes connected by semantic + causal relationships
 * - Patterns activate seed papers, which propagate activation through edges
 * - Multi-hop propagation finds related papers with adaptive depth
 * - Confidence aggregation handles conflicting evidence
 */

export type EdgeType = "semantic_similar" | "topic_overlap" | "complementary" | "contradicts" | "enables" | "time_lag";

export interface PaperNode {
  id: string;                    // Paper slug/identifier
  title: string;
  authors: string;
  year: number;
  source: string;                // Journal name
  url: string | null;
  topics: string[];              // Tags: "sleep", "exercise", etc.
  evidenceLevel: "rct" | "systematic_review" | "observational" | "review" | "case_report";
  sampleSize: number | null;
  embedding: number[];           // 768-dim vector from Gemini
  curated: boolean;              // true for seed corpus, false for live PubMed
  summary: string;
}

export interface PaperEdge {
  sourcePaperId: string;
  targetPaperId: string;
  edgeType: EdgeType;
  weight: number;                // 0.0-1.0, higher = stronger relationship
  reasoning: string;             // Why papers are connected
}

export interface ActivationResult {
  paperId: string;
  paper: PaperNode;
  activationScore: number;       // 0.0-1.0 final activation after propagation
  path: string[];                // [seed_paper, intermediate_1, ..., this_paper]
  hopCount: number;              // How many hops from seed
  confidence: "strong" | "moderate" | "limited";
}

export interface ActivationContext {
  query: string;
  complexity: number;            // 1-10, determines propagation depth
  decayFactor: number;           // 0.7 = activation decays 30% per hop
  maxDepth: number;              // 1-3 depending on complexity
}

export class KnowledgeGraph {
  private papers: Map<string, PaperNode> = new Map();
  private edges: Map<string, PaperEdge[]> = new Map();  // source_id -> edges[]
  private activationCache: Map<string, ActivationResult[]> = new Map();
  private cacheTTL = 10 * 60 * 1000;  // 10 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    this.papers = new Map();
    this.edges = new Map();
  }

  /**
   * Load papers and relationships into the graph
   */
  loadGraph(papers: PaperNode[], edges: PaperEdge[]): void {
    // Load papers as nodes
    papers.forEach((paper) => {
      this.papers.set(paper.id, paper);
      if (!this.edges.has(paper.id)) {
        this.edges.set(paper.id, []);
      }
    });

    // Load edges (bidirectional for non-directional relationships)
    edges.forEach((edge) => {
      this.edges.get(edge.sourcePaperId)?.push(edge);

      // For symmetric relationships, add reverse edge
      if (["semantic_similar", "topic_overlap", "contradicts"].includes(edge.edgeType)) {
        const reverseEdge: PaperEdge = {
          sourcePaperId: edge.targetPaperId,
          targetPaperId: edge.sourcePaperId,
          edgeType: edge.edgeType,
          weight: edge.weight,
          reasoning: edge.reasoning,
        };
        this.edges.get(edge.targetPaperId)?.push(reverseEdge);
      }
    });

    console.log(`✓ Knowledge Graph loaded: ${papers.length} papers, ${edges.length} edges`);
  }

  /**
   * Get all neighbors of a paper (direct connections, depth=1)
   */
  getNeighbors(paperId: string, maxDepth: number = 1): PaperNode[] {
    const neighbors: Set<string> = new Set();
    const queue: [string, number][] = [[paperId, 0]];
    const visited: Set<string> = new Set([paperId]);

    while (queue.length > 0) {
      const [currentId, depth] = queue.shift()!;

      if (depth >= maxDepth) continue;

      const edges = this.edges.get(currentId) || [];
      for (const edge of edges) {
        if (!visited.has(edge.targetPaperId)) {
          visited.add(edge.targetPaperId);
          neighbors.add(edge.targetPaperId);
          queue.push([edge.targetPaperId, depth + 1]);
        }
      }
    }

    return Array.from(neighbors)
      .map((id) => this.papers.get(id))
      .filter((p) => p !== undefined) as PaperNode[];
  }

  /**
   * Compute case complexity (1-10) based on number/severity of patterns
   * Used to determine propagation depth dynamically
   */
  computeCaseComplexity(patternCount: number, avgSeverity: number): number {
    // complexity = patterns_count * severity_factor
    // 1 low-severity pattern = 1-2
    // 3 mixed patterns = 4-6
    // 5+ severe patterns = 8-10
    const severityFactor = avgSeverity * 3;  // 0-3 range
    const complexity = Math.min(10, patternCount * severityFactor);
    return Math.max(1, complexity);
  }

  /**
   * Determine propagation depth based on case complexity
   * Dynamic: simple cases = 1 hop, complex = 2-3 hops
   */
  determinePropagationDepth(complexity: number): number {
    if (complexity < 2) return 1;
    if (complexity < 5) return 2;
    return 3;
  }

  /**
   * Activate seed papers based on query similarity
   * Returns initial activation scores for papers matching the query/pattern
   */
  activateSeeds(query: string, seedPaperIds: string[], topK: number = 10): Map<string, number> {
    const activation = new Map<string, number>();

    // For seed papers, start with high activation
    seedPaperIds.forEach((paperId) => {
      const paper = this.papers.get(paperId);
      if (paper) {
        activation.set(paperId, 0.9);  // High initial activation
      }
    });

    // If no explicit seeds, find papers by semantic similarity
    if (seedPaperIds.length === 0) {
      const similarities = this.searchBySimilarity(query, topK);
      similarities.forEach(({ paperId, score }) => {
        activation.set(paperId, score);
      });
    }

    return activation;
  }

  /**
   * Find papers by semantic similarity to query
   * (Placeholder: actual implementation will use Gemini embeddings)
   */
  private searchBySimilarity(query: string, topK: number): Array<{ paperId: string; score: number }> {
    // TODO: Implement actual embedding similarity search
    // For now, return empty (will be replaced by actual semantic search)
    return [];
  }

  /**
   * Propagate activation through the graph
   * Multi-hop BFS with decay factor per hop
   */
  propagateActivation(
    seedActivation: Map<string, number>,
    context: ActivationContext
  ): Map<string, ActivationResult> {
    const results = new Map<string, ActivationResult>();
    const visited: Set<string> = new Set();
    const queue: Array<[string, number, string[], number]> = [];  // [paperId, activation, path, hopCount]

    // Initialize queue with seeds
    seedActivation.forEach((activation, paperId) => {
      const paper = this.papers.get(paperId);
      if (paper) {
        queue.push([paperId, activation, [paperId], 0]);
        visited.add(paperId);
        results.set(paperId, {
          paperId,
          paper,
          activationScore: activation,
          path: [paperId],
          hopCount: 0,
          confidence: this.scoreToConfidence(activation),
        });
      }
    });

    // BFS with decay
    while (queue.length > 0) {
      const [currentId, currentActivation, path, hopCount] = queue.shift()!;

      if (hopCount >= context.maxDepth) continue;

      const edges = this.edges.get(currentId) || [];
      for (const edge of edges) {
        const newActivation = currentActivation * edge.weight * Math.pow(context.decayFactor, hopCount + 1);

        if (newActivation < 0.1) continue;  // Skip very low activations

        const neighbor = this.papers.get(edge.targetPaperId);
        if (!neighbor || visited.has(edge.targetPaperId)) continue;

        visited.add(edge.targetPaperId);
        const newPath = [...path, edge.targetPaperId];

        queue.push([edge.targetPaperId, newActivation, newPath, hopCount + 1]);

        results.set(edge.targetPaperId, {
          paperId: edge.targetPaperId,
          paper: neighbor,
          activationScore: newActivation,
          path: newPath,
          hopCount: hopCount + 1,
          confidence: this.scoreToConfidence(newActivation),
        });
      }
    }

    return results;
  }

  /**
   * Convert activation score to human-readable confidence level
   */
  private scoreToConfidence(score: number): "strong" | "moderate" | "limited" {
    if (score >= 0.7) return "strong";
    if (score >= 0.4) return "moderate";
    return "limited";
  }

  /**
   * Search via graph: semantic search + propagation
   * Returns top-K papers ranked by activation score
   */
  searchViaGraph(
    query: string,
    patternCount: number = 1,
    avgSeverity: number = 1,
    topK: number = 5
  ): ActivationResult[] {
    // Check cache
    const cacheKey = `${query}:${patternCount}:${avgSeverity}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Compute complexity
    const complexity = this.computeCaseComplexity(patternCount, avgSeverity);
    const maxDepth = this.determinePropagationDepth(complexity);

    const context: ActivationContext = {
      query,
      complexity,
      decayFactor: 0.7,
      maxDepth,
    };

    // Find seed papers (would use semantic search with Gemini in production)
    const seeds = new Map<string, number>();
    // TODO: Replace with actual semantic search
    // For now, activate papers matching query in topics
    this.papers.forEach((paper) => {
      const hasRelevantTopic = paper.topics.some((topic) =>
        query.toLowerCase().includes(topic) || topic.includes(query.toLowerCase())
      );
      if (hasRelevantTopic) {
        seeds.set(paper.id, 0.8);
      }
    });

    // Propagate
    const activation = this.propagateActivation(seeds, context);

    // Sort by activation score and return top-K
    const results = Array.from(activation.values())
      .sort((a, b) => b.activationScore - a.activationScore)
      .slice(0, topK);

    // Cache results
    this.setInCache(cacheKey, results);

    return results;
  }

  /**
   * Get activation path for a paper (which seed → which edges → this paper)
   */
  getActivationPath(paperId: string, results: ActivationResult[]): string[] {
    const result = results.find((r) => r.paperId === paperId);
    return result?.path || [];
  }

  /**
   * Detect contradictions: papers with negative activation to same pattern
   */
  detectContradictions(results: ActivationResult[]): Array<{
    paperId: string;
    conflictsWith: string[];
  }> {
    const contradictions: Array<{ paperId: string; conflictsWith: string[] }> = [];

    results.forEach((result) => {
      const conflicts: string[] = [];
      const edges = this.edges.get(result.paperId) || [];

      edges.forEach((edge) => {
        if (edge.edgeType === "contradicts") {
          const conflictingResult = results.find((r) => r.paperId === edge.targetPaperId);
          if (conflictingResult && conflictingResult.activationScore > 0.3) {
            conflicts.push(edge.targetPaperId);
          }
        }
      });

      if (conflicts.length > 0) {
        contradictions.push({ paperId: result.paperId, conflictsWith: conflicts });
      }
    });

    return contradictions;
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): ActivationResult[] | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.cacheTTL) {
      return null;
    }
    return this.activationCache.get(key) || null;
  }

  private setInCache(key: string, results: ActivationResult[]): void {
    this.activationCache.set(key, results);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clear cache (on new paper ingestion)
   */
  clearCache(): void {
    this.activationCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get graph statistics
   */
  getStats(): { nodeCount: number; edgeCount: number; avgDegree: number } {
    let totalEdges = 0;
    this.edges.forEach((edgeList) => {
      totalEdges += edgeList.length;
    });

    const avgDegree = this.papers.size > 0 ? totalEdges / this.papers.size : 0;

    return {
      nodeCount: this.papers.size,
      edgeCount: totalEdges,
      avgDegree,
    };
  }
}
