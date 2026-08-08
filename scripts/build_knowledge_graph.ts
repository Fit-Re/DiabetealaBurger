#!/usr/bin/env npx ts-node
/**
 * Build Knowledge Graph from 48-paper CSV
 *
 * This script:
 * 1. Loads 48 papers (39 PubMed + 9 Consensus) from CSV
 * 2. Computes all-pairs semantic similarity
 * 3. Auto-detects edges (similarity > 0.7)
 * 4. Allows manual review + adds causal chains
 * 5. Exports paper_relationships for Supabase import
 *
 * Usage:
 *   npx ts-node scripts/build_knowledge_graph.ts \
 *     --csv kb_papers_import_48_combined.csv \
 *     --output paper_relationships.json
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ============================================================================
// Types
// ============================================================================

interface PaperRecord {
  id: string;
  title: string;
  authors: string;
  year: number;
  topics: string;
  evidenceLevel: string;
  sampleSize: string;
  summary: string;
}

interface PaperNode {
  id: string;
  title: string;
  authors: string;
  year: number;
  topics: string[];
  evidenceLevel: string;
  embedding?: number[];  // Will be fetched from Gemini later
}

interface PaperEdge {
  sourcePaperId: string;
  targetPaperId: string;
  edgeType: "semantic_similar" | "topic_overlap" | "complementary" | "contradicts" | "enables" | "time_lag";
  weight: number;
  reasoning: string;
}

// ============================================================================
// CSV Parser
// ============================================================================

function loadPapersFromCSV(csvPath: string): PaperNode[] {
  console.log(`📖 Loading papers from ${csvPath}...`);

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV file must have header + at least 1 paper");
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const papers: PaperNode[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length < 11) continue;  // Skip incomplete rows

    const record: Record<string, string | number> = {};
    header.forEach((col, idx) => {
      record[col] = values[idx];
    });

    const paper: PaperNode = {
      id: String(record["ID"]),
      title: String(record["Título"]),
      authors: String(record["Autores"]),
      year: parseInt(String(record["Año"])) || new Date().getFullYear(),
      topics: (String(record["Tópicos"] || "").split(";")).map((t) => t.trim()).filter(Boolean),
      evidenceLevel: String(record["Evidence Level"]),
    };

    if (paper.id && paper.title) {
      papers.push(paper);
    }
  }

  console.log(`✅ Loaded ${papers.length} papers`);
  return papers;
}

// ============================================================================
// Similarity Computation
// ============================================================================

/**
 * Compute topic overlap between two papers
 * Returns 0.0-1.0 score based on shared topics
 */
function computeTopicSimilarity(paper1: PaperNode, paper2: PaperNode): number {
  if (paper1.topics.length === 0 || paper2.topics.length === 0) return 0;

  const shared = paper1.topics.filter((t) => paper2.topics.includes(t));
  const union = new Set([...paper1.topics, ...paper2.topics]);

  return shared.length / union.size;
}

/**
 * Compute evidence level compatibility
 * RCT/Systematic Review = higher, observational/case report = lower
 */
function computeEvidenceSimilarity(paper1: PaperNode, paper2: PaperNode): number {
  const levelRank: Record<string, number> = {
    "rct": 5,
    "systematic_review": 5,
    "review": 3,
    "observational": 2,
    "case_report": 1,
  };

  const level1 = levelRank[paper1.evidenceLevel.toLowerCase()] || 2;
  const level2 = levelRank[paper2.evidenceLevel.toLowerCase()] || 2;

  const diff = Math.abs(level1 - level2);
  return 1.0 - diff / 4.0;  // Max diff = 4, normalize to [0,1]
}

/**
 * Compute year proximity
 * Papers within 3 years = high similarity
 */
function computeYearSimilarity(paper1: PaperNode, paper2: PaperNode): number {
  const yearDiff = Math.abs(paper1.year - paper2.year);
  return Math.max(0, 1.0 - yearDiff / 10.0);  // Decay over 10 years
}

/**
 * Compute combined similarity score (0.0-1.0)
 * Weighted average of topic, evidence, and year similarity
 */
function computeSimilarity(paper1: PaperNode, paper2: PaperNode): number {
  const topicSim = computeTopicSimilarity(paper1, paper2);
  const evidenceSim = computeEvidenceSimilarity(paper1, paper2);
  const yearSim = computeYearSimilarity(paper1, paper2);

  // Weights: topics most important (0.5), evidence (0.3), year (0.2)
  return topicSim * 0.5 + evidenceSim * 0.3 + yearSim * 0.2;
}

// ============================================================================
// Edge Detection
// ============================================================================

/**
 * Auto-detect edges from similarity matrix
 * Returns edges with similarity > threshold
 */
function autoDetectEdges(papers: PaperNode[], threshold: number = 0.7): PaperEdge[] {
  console.log(`\n🔗 Computing similarity matrix for ${papers.length} papers...`);

  const edges: PaperEdge[] = [];

  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const similarity = computeSimilarity(papers[i], papers[j]);

      if (similarity >= threshold) {
        edges.push({
          sourcePaperId: papers[i].id,
          targetPaperId: papers[j].id,
          edgeType: "semantic_similar",
          weight: similarity,
          reasoning: `Topic overlap: ${papers[i].topics.join(", ")} <-> ${papers[j].topics.join(", ")}`,
        });
      }
    }
  }

  console.log(`✅ Auto-detected ${edges.length} edges (similarity ≥ ${threshold})`);
  return edges;
}

// ============================================================================
// Manual Edge Addition
// ============================================================================

/**
 * Interactive CLI for manual edge review
 * User can add causal chains, contradictions, etc.
 */
async function manualEdgeReview(papers: PaperNode[], autoEdges: PaperEdge[]): Promise<PaperEdge[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log("\n📝 Manual Edge Review Mode");
  console.log("Commands:");
  console.log("  list        — Show papers");
  console.log("  add <from> <to> <type> — Add edge");
  console.log("  done        — Finish review\n");

  let edges = [...autoEdges];
  let running = true;

  while (running) {
    const input = await question(">>> ");
    const parts = input.trim().split(" ");
    const command = parts[0].toLowerCase();

    if (command === "done") {
      running = false;
    } else if (command === "list") {
      papers.forEach((p) => {
        console.log(`  [${p.id}] ${p.title} (${p.year})`);
      });
    } else if (command === "add" && parts.length >= 4) {
      const fromId = parts[1];
      const toId = parts[2];
      const edgeType = parts[3] as any;

      const from = papers.find((p) => p.id === fromId);
      const to = papers.find((p) => p.id === toId);

      if (from && to) {
        edges.push({
          sourcePaperId: fromId,
          targetPaperId: toId,
          edgeType,
          weight: 0.8,
          reasoning: `Manually added: ${edgeType}`,
        });
        console.log(`✓ Added edge: ${fromId} → ${toId} (${edgeType})`);
      } else {
        console.log("❌ Paper not found");
      }
    } else {
      console.log("Unknown command");
    }
  }

  rl.close();
  return edges;
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export edges to JSON for Supabase import
 */
function exportEdges(edges: PaperEdge[], outputPath: string): void {
  const output = {
    metadata: {
      exportedAt: new Date().toISOString(),
      totalEdges: edges.length,
      edgeTypes: edges.reduce((acc, e) => {
        acc[e.edgeType] = (acc[e.edgeType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    edges,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Exported ${edges.length} edges to ${outputPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const csvPath = process.argv[process.argv.indexOf("--csv") + 1] || "kb_papers_import_48_combined.csv";
  const outputPath = process.argv[process.argv.indexOf("--output") + 1] || "paper_relationships.json";
  const skipManual = process.argv.includes("--skip-manual");

  try {
    // Load papers
    const papers = loadPapersFromCSV(csvPath);

    // Auto-detect edges
    let edges = autoDetectEdges(papers, 0.7);

    // Manual review (unless skipped)
    if (!skipManual) {
      edges = await manualEdgeReview(papers, edges);
    }

    // Export
    exportEdges(edges, outputPath);

    console.log("\n🎉 Knowledge graph built successfully!");
    console.log(`   Papers: ${papers.length}`);
    console.log(`   Edges: ${edges.length}`);
    console.log(`   Output: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
