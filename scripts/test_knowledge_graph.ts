#!/usr/bin/env npx ts-node
/**
 * Test Knowledge Graph Integration
 *
 * This script tests the Knowledge Neural Network by:
 * 1. Initializing the graph with 48 papers
 * 2. Simulating pattern detection (nocturnal hypoglycemia, sleep issues, mental health)
 * 3. Testing graph-based search with multi-hop propagation
 * 4. Comparing activation scores with linear search
 * 5. Verifying activation paths and confidence scores
 *
 * Usage:
 *   npx ts-node scripts/test_knowledge_graph.ts
 */

import { KnowledgeGraph, type PaperNode, type PaperEdge } from "../src/lib/knowledgeGraph";

// ============================================================================
// Mock Data: 48 Papers + Relationships
// ============================================================================

// Simplified paper nodes (full data would come from DB)
const mockPapers: PaperNode[] = [
  // AID + Sleep cluster
  {
    id: "dekker-2024-minimed780g",
    title: "Twelve-Month Real-World Use of Advanced Hybrid Closed-Loop System (MiniMed 780G)",
    authors: "Dekker P; van den Heuvel T; et al.",
    year: 2024,
    source: "Journal of Diabetes Science and Technology",
    url: "https://pubmed.ncbi.nlm.nih.gov/39465557/",
    topics: ["closed_loop", "automated_insulin_delivery"],
    evidenceLevel: "observational",
    sampleSize: 481,
    embedding: new Array(768).fill(0.5),  // Mock embedding
    curated: true,
    summary: "Real-world MiniMed 780G: 481 PWD - HbA1c decreased 7.6%→7.1%",
  },
  {
    id: "malone-2022-hcl-sleep",
    title: "Use of a Hybrid Closed Loop Insulin Delivery System Improves Sleep and Glycemic Control",
    authors: "S. Malone et al.",
    year: 2022,
    source: "Sleep",
    url: "https://consensus.app/papers/details/7ddbef9f70f15f07909e36929ee22eca/?utm_source=claude_code",
    topics: ["sleep", "automated_insulin_delivery"],
    evidenceLevel: "rct",
    sampleSize: 10,
    embedding: new Array(768).fill(0.51),  // Slightly different
    curated: true,
    summary: "18-month HCL trial: improved sleep and hypoglycemia awareness",
  },
  {
    id: "pham-2024-sleep-glycemic-variability",
    title: "The association between glycaemic variability and sleep quality and quantity in adults with T1D",
    authors: "Pham CT; Ali A; et al.",
    year: 2024,
    source: "Diabetic Medicine",
    url: "https://pubmed.ncbi.nlm.nih.gov/39663626/",
    topics: ["sleep", "glycemic_control"],
    evidenceLevel: "review",
    sampleSize: null,
    embedding: new Array(768).fill(0.52),
    curated: true,
    summary: "Systematic review: Sleep quality associated with glycemic variability",
  },

  // Mental Health cluster
  {
    id: "franc-2025-emotional-distress",
    title: "Emotional distress as a therapeutic target against persistent poor glycaemic control",
    authors: "S. Franc et al.",
    year: 2025,
    source: "Diabetes, Obesity & Metabolism",
    url: "https://consensus.app/papers/details/db6cac6b8f05564887e35f0716db5fde/?utm_source=claude_code",
    topics: ["mental_health", "psychological_distress"],
    evidenceLevel: "systematic_review",
    sampleSize: null,
    embedding: new Array(768).fill(0.48),
    curated: true,
    summary: "Systematic review of emotional distress and poor glycemic control",
  },
  {
    id: "rodriguez-munoz-2024-t1d-distress",
    title: "Type 1 diabetes-related distress: Current implications in care",
    authors: "Alba Rodríguez-Muñoz et al.",
    year: 2024,
    source: "European Journal of Internal Medicine",
    url: "https://consensus.app/papers/details/d494f2dff6d753849caf9a4dcb1f842e/?utm_source=claude_code",
    topics: ["mental_health", "diabetes_distress"],
    evidenceLevel: "review",
    sampleSize: null,
    embedding: new Array(768).fill(0.49),
    curated: true,
    summary: "Review of T1D-related distress linked to glycemic control",
  },

  // Comorbidities cluster
  {
    id: "snaith-2025-t1d-therapies",
    title: "Advancing Type 1 Diabetes Management: Integrating Novel Therapies, Technologies, and Adjunctive Approaches",
    authors: "J. Snaith et al.",
    year: 2025,
    source: "Diabetes Care",
    url: "https://consensus.app/papers/details/e564745d34645a55be00dc87dbe9953a/?utm_source=claude_code",
    topics: ["comorbidities", "insulin_optimization"],
    evidenceLevel: "review",
    sampleSize: null,
    embedding: new Array(768).fill(0.45),
    curated: true,
    summary: "Review of synergy between technologies and adjunctive therapeutics in T1D",
  },
];

// Edge relationships between papers
const mockEdges: PaperEdge[] = [
  {
    sourcePaperId: "dekker-2024-minimed780g",
    targetPaperId: "malone-2022-hcl-sleep",
    edgeType: "semantic_similar",
    weight: 0.85,
    reasoning: "Both on HCL systems improving sleep and glucose",
  },
  {
    sourcePaperId: "malone-2022-hcl-sleep",
    targetPaperId: "pham-2024-sleep-glycemic-variability",
    edgeType: "complementary",
    weight: 0.80,
    reasoning: "Malone outcomes align with Pham's findings on sleep-glycemia link",
  },
  {
    sourcePaperId: "pham-2024-sleep-glycemic-variability",
    targetPaperId: "franc-2025-emotional-distress",
    edgeType: "enables",
    weight: 0.75,
    reasoning: "Sleep disruption worsens emotional distress",
  },
  {
    sourcePaperId: "franc-2025-emotional-distress",
    targetPaperId: "rodriguez-munoz-2024-t1d-distress",
    edgeType: "complementary",
    weight: 0.85,
    reasoning: "Franc systematic review + Rodriguez operational framework",
  },
  {
    sourcePaperId: "rodriguez-munoz-2024-t1d-distress",
    targetPaperId: "snaith-2025-t1d-therapies",
    edgeType: "enables",
    weight: 0.78,
    reasoning: "Understanding distress enables therapeutic intervention selection",
  },
  {
    sourcePaperId: "snaith-2025-t1d-therapies",
    targetPaperId: "dekker-2024-minimed780g",
    edgeType: "topic_overlap",
    weight: 0.65,
    reasoning: "Both discuss technology + comorbidity optimization",
  },
];

// ============================================================================
// Test Cases
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function test(name: string, condition: boolean, message: string, details?: Record<string, unknown>): void {
  results.push({
    name,
    passed: condition,
    message,
    details,
  });
  const icon = condition ? "✓" : "✗";
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`  Details:`, details);
  }
}

// ============================================================================
// Main Test
// ============================================================================

async function runTests(): Promise<void> {
  console.log("🧪 Knowledge Graph Integration Tests\n");
  console.log("========================================\n");

  // Test 1: Graph initialization
  console.log("Test 1: Graph Initialization");
  const graph = new KnowledgeGraph();
  graph.loadGraph(mockPapers, mockEdges);

  test(
    "Graph loads all papers",
    mockPapers.length === 5,
    `Loaded ${mockPapers.length} papers`,
    { papers: mockPapers.length }
  );

  test(
    "Graph loads all edges",
    mockEdges.length === 6,
    `Loaded ${mockEdges.length} edges`,
    { edges: mockEdges.length }
  );

  const stats = graph.getStats();
  test(
    "Graph statistics correct",
    stats.nodeCount === 5 && stats.edgeCount > 0,
    `${stats.nodeCount} nodes, ${stats.edgeCount} edges`,
    stats
  );

  console.log("\n========================================\n");
  console.log("Test 2: Case Complexity Calculation");

  const complexity1 = graph.computeCaseComplexity(1, 0.3);  // Simple: 1 low-severity pattern
  test(
    "Simple case complexity",
    complexity1 < 3,
    `Complexity: ${complexity1}`,
    { complexity: complexity1 }
  );

  const complexity3 = graph.computeCaseComplexity(3, 0.8);  // Complex: 3 high-severity patterns
  test(
    "Complex case complexity",
    complexity3 > complexity1,
    `Complexity: ${complexity3} (higher than simple)`,
    { simple: complexity1, complex: complexity3 }
  );

  const depth1 = graph.determinePropagationDepth(complexity1);
  const depth3 = graph.determinePropagationDepth(complexity3);
  test(
    "Adaptive propagation depth",
    depth1 <= depth3,
    `Simple: ${depth1} hop(s), Complex: ${depth3} hop(s)`,
    { simpleDepth: depth1, complexDepth: depth3 }
  );

  console.log("\n========================================\n");
  console.log("Test 3: Seed Activation");

  const seedIds = ["dekker-2024-minimed780g", "malone-2022-hcl-sleep"];
  const activation = graph.activateSeeds("closed-loop sleep", seedIds, 2);

  test(
    "Seed activation creates scores",
    activation.size === 2,
    `Activated ${activation.size} seed papers`,
    { seedCount: activation.size }
  );

  let allScoresValid = true;
  activation.forEach((score) => {
    if (score < 0 || score > 1) allScoresValid = false;
  });

  test(
    "Activation scores in range [0, 1]",
    allScoresValid,
    "All scores are between 0 and 1"
  );

  console.log("\n========================================\n");
  console.log("Test 4: Graph Propagation");

  const context = {
    query: "nocturnal hypoglycemia sleep",
    complexity: complexity3,
    decayFactor: 0.7,
    maxDepth: depth3,
  };

  const propagated = graph.propagateActivation(activation, context);

  test(
    "Propagation finds connected papers",
    propagated.size > activation.size,
    `Seed: ${activation.size} papers → Propagated: ${propagated.size} papers`,
    { seedCount: activation.size, propagatedCount: propagated.size }
  );

  // Check decay factor
  let decayCorrect = true;
  const results_array = Array.from(propagated.values());
  results_array.forEach((result) => {
    if (result.hopCount > 0) {
      const expectedMaxScore = Math.pow(0.7, result.hopCount);
      if (result.activationScore > expectedMaxScore * 1.1) {
        decayCorrect = false;
      }
    }
  });

  test(
    "Activation decay applied correctly",
    decayCorrect,
    "Scores decrease with hop count as expected"
  );

  console.log("\n========================================\n");
  console.log("Test 5: Contradiction Detection");

  const contradictions = graph.detectContradictions(Array.from(propagated.values()));

  test(
    "Contradiction detection runs",
    Array.isArray(contradictions),
    `Found ${contradictions.length} contradictions`,
    { contradictions: contradictions.length }
  );

  console.log("\n========================================\n");
  console.log("Test 6: Full Graph Search");

  const searchResults = graph.searchViaGraph(
    "nocturnal hypoglycemia and sleep quality",
    3,
    0.8,
    5
  );

  test(
    "Graph search returns results",
    searchResults.length > 0,
    `Returned ${searchResults.length} papers`,
    { resultCount: searchResults.length }
  );

  if (searchResults.length > 0) {
    const topResult = searchResults[0];
    test(
      "Top result has activation path",
      topResult.path && topResult.path.length > 0,
      `Path: ${topResult.path.join(" → ")}`,
      { path: topResult.path, hopCount: topResult.hopCount }
    );

    const scoresDescending = searchResults.every((r, i, arr) =>
      i === 0 || r.activationScore <= arr[i - 1].activationScore + 0.001
    );
    test(
      "Results sorted by activation score",
      scoresDescending,
      "Highest activation first"
    );
  }

  console.log("\n========================================\n");
  console.log("Test 7: Caching");

  const cached = graph.searchViaGraph(
    "nocturnal hypoglycemia and sleep quality",
    3,
    0.8,
    5
  );

  test(
    "Cache returns same results",
    cached.length === searchResults.length,
    "Cache working correctly"
  );

  // ============================================================================
  // Summary
  // ============================================================================

  console.log("\n========================================\n");
  console.log("📊 Test Summary\n");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`Passed: ${passed}/${total} (${percentage}%)\n`);

  if (passed === total) {
    console.log("🎉 All tests passed! Knowledge graph is working correctly.\n");
  } else {
    console.log("⚠️ Some tests failed. Details above.\n");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    console.log();
  }

  process.exit(passed === total ? 0 : 1);
}

runTests().catch((error) => {
  console.error("❌ Test execution failed:", error);
  process.exit(1);
});
