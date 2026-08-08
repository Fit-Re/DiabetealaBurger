#!/usr/bin/env npx tsx
/**
 * Test Knowledge Graph Deployment
 *
 * After deploying migrations to Supabase, this script verifies:
 * 1. 48 papers are in knowledge_chunks
 * 2. 50+ relationships are in paper_relationships
 * 3. Graph can be initialized with real data
 * 4. Search works with multi-hop activation
 *
 * Usage:
 *   npx tsx scripts/test_deployment.ts
 */

import { createClient } from "@supabase/supabase-js";
import { KnowledgeGraph, type PaperNode } from "../src/lib/knowledgeGraph";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function test(name: string, condition: boolean, message: string, details?: Record<string, unknown>): void {
  results.push({ name, passed: condition, message, details });
  const icon = condition ? "✓" : "✗";
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`  Details:`, details);
  }
}

async function runTests(): Promise<void> {
  console.log("🧪 Knowledge Graph Deployment Tests\n");
  console.log("========================================\n");

  // Test 1: Papers loaded
  console.log("Test 1: Data in Supabase\n");

  try {
    const { data: papers, error: paperError, count: paperCount } = await supabase
      .from("knowledge_chunks")
      .select("id, title, year", { count: "exact" })
      .eq("curated", true);

    test(
      "Papers loaded (48)",
      !paperError && papers && papers.length === 48,
      `Found ${papers?.length || 0} papers`,
      { count: papers?.length || 0, error: paperError?.message }
    );

    if (papers && papers.length > 0) {
      console.log(`  Sample papers:`);
      papers.slice(0, 3).forEach((p) => {
        console.log(`    • ${p.title} (${p.year})`);
      });
    }
  } catch (err) {
    test("Papers loaded (48)", false, `Error: ${err}`);
  }

  console.log();

  // Test 2: Relationships loaded
  console.log("Test 2: Relationships in Supabase\n");

  try {
    const { data: relationships, error: relError } = await supabase
      .from("paper_relationships")
      .select("id, paper_id_a, paper_id_b, edge_type, weight");

    test(
      "Relationships loaded (50+)",
      !relError && relationships && relationships.length >= 50,
      `Found ${relationships?.length || 0} relationships`,
      { count: relationships?.length || 0, error: relError?.message }
    );

    if (relationships && relationships.length > 0) {
      const edgeTypes = relationships.reduce((acc, r) => {
        acc[r.edge_type] = (acc[r.edge_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`  Edge types:`);
      Object.entries(edgeTypes).forEach(([type, count]) => {
        console.log(`    • ${type}: ${count}`);
      });
    }
  } catch (err) {
    test("Relationships loaded (50+)", false, `Error: ${err}`);
  }

  console.log();

  // Test 3: Graph initialization
  console.log("Test 3: Graph Initialization\n");

  try {
    const { data: papers } = await supabase
      .from("knowledge_chunks")
      .select("id, title, authors, year, source, url, topic, embedding, curated, summary")
      .eq("curated", true);

    const { data: relationships } = await supabase
      .from("paper_relationships")
      .select("paper_id_a, paper_id_b, edge_type, weight, reasoning");

    if (!papers || papers.length === 0) {
      test("Graph initialization", false, "No papers found in database");
    } else if (!relationships || relationships.length === 0) {
      test("Graph initialization", false, "No relationships found in database");
    } else {
      try {
        const graph = new KnowledgeGraph();

        // Convert papers to PaperNode format
        const nodes: PaperNode[] = papers.map((p) => ({
          id: p.id,
          title: p.title,
          authors: p.authors,
          year: p.year,
          source: p.source,
          url: p.url,
          topics: p.topic ? [p.topic] : [],
          evidenceLevel: "observational" as const,
          sampleSize: null,
          embedding: Array.isArray(p.embedding) ? p.embedding : new Array(768).fill(0),
          curated: p.curated,
          summary: p.summary,
        }));

        // Convert relationships to edges
        const edges = relationships.map((r) => ({
          sourcePaperId: r.paper_id_a,
          targetPaperId: r.paper_id_b,
          edgeType: r.edge_type as any,
          weight: r.weight,
          reasoning: r.reasoning,
        }));

        graph.loadGraph(nodes, edges);
        const stats = graph.getStats();

        test(
          "Graph initialization",
          stats.nodeCount > 0 && stats.edgeCount > 0,
          `Loaded ${stats.nodeCount} nodes, ${stats.edgeCount} edges`,
          stats
        );
      } catch (err) {
        test("Graph initialization", false, `Graph creation failed: ${err}`);
      }
    }
  } catch (err) {
    test("Graph initialization", false, `Error: ${err}`);
  }

  console.log();

  // Test 4: Sample search
  console.log("Test 4: Graph Search Simulation\n");

  try {
    const { data: papers } = await supabase
      .from("knowledge_chunks")
      .select("id, title, authors, year, source, url, topic, embedding, curated, summary")
      .eq("curated", true);

    const { data: relationships } = await supabase
      .from("paper_relationships")
      .select("paper_id_a, paper_id_b, edge_type, weight, reasoning");

    if (papers && relationships) {
      const graph = new KnowledgeGraph();

      const nodes: PaperNode[] = papers.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        source: p.source,
        url: p.url,
        topics: p.topic ? [p.topic] : [],
        evidenceLevel: "observational" as const,
        sampleSize: null,
        embedding: Array.isArray(p.embedding) ? p.embedding : new Array(768).fill(0),
        curated: p.curated,
        summary: p.summary,
      }));

      const edges = relationships.map((r) => ({
        sourcePaperId: r.paper_id_a,
        targetPaperId: r.paper_id_b,
        edgeType: r.edge_type as any,
        weight: r.weight,
        reasoning: r.reasoning,
      }));

      graph.loadGraph(nodes, edges);

      // Test search
      const results = graph.searchViaGraph(
        "nocturnal hypoglycemia sleep",
        3,  // 3 patterns
        0.8,  // high severity
        5   // top 5 papers
      );

      test(
        "Graph search returns results",
        results.length > 0,
        `Found ${results.length} papers with activation paths`,
        { resultCount: results.length }
      );

      if (results.length > 0) {
        console.log(`  Top results:`);
        results.slice(0, 3).forEach((r) => {
          console.log(`    • ${r.paper.title} (activation: ${r.activationScore.toFixed(2)}, hops: ${r.hopCount})`);
        });
      }
    }
  } catch (err) {
    test("Graph search returns results", false, `Error: ${err}`);
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log("\n========================================\n");
  console.log("📊 Deployment Test Summary\n");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`Passed: ${passed}/${total} (${percentage}%)\n`);

  if (passed === total) {
    console.log("🎉 All tests passed! Deployment successful.\n");
    console.log("✅ Next steps:");
    console.log("   1. Update autoEnrich.ts to use searchViaGraph()");
    console.log("   2. Update geminiVision.ts to show activation paths");
    console.log("   3. Deploy Phase 2: Evidence Synthesis\n");
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
