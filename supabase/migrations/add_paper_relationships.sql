-- Knowledge Neural Network: Paper Relationships Table
-- Stores connections between papers for graph-based correlation and activation

BEGIN;

-- Paper relationships (edges in the knowledge graph)
CREATE TABLE IF NOT EXISTS paper_relationships (
  id BIGSERIAL PRIMARY KEY,

  -- Edge endpoints
  paper_id_a TEXT NOT NULL,              -- Source paper slug
  paper_id_b TEXT NOT NULL,              -- Target paper slug

  -- Relationship metadata
  edge_type TEXT NOT NULL CHECK (
    edge_type IN (
      'semantic_similar',                -- Semantic similarity > threshold
      'topic_overlap',                   -- Shared topics/tags
      'complementary',                   -- Paper B elaborates on A
      'contradicts',                     -- Paper B contradicts A
      'enables',                         -- Paper B enables A's approach
      'time_lag'                         -- Time-lagged causality
    )
  ),

  -- Edge weight: relationship strength (0.0-1.0)
  -- Higher = stronger relationship
  weight REAL NOT NULL DEFAULT 0.5 CHECK (weight >= 0.0 AND weight <= 1.0),

  -- Human-readable reasoning for this connection
  reasoning TEXT,

  -- Metadata
  created_at_ms BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,

  -- Prevent self-loops and duplicates
  CONSTRAINT no_self_loops CHECK (paper_id_a != paper_id_b),
  CONSTRAINT unique_edge UNIQUE (paper_id_a, paper_id_b, edge_type)
);

-- Indexes for efficient graph traversal
CREATE INDEX idx_paper_relationships_source ON paper_relationships(paper_id_a);
CREATE INDEX idx_paper_relationships_target ON paper_relationships(paper_id_b);
CREATE INDEX idx_paper_relationships_type ON paper_relationships(edge_type);
CREATE INDEX idx_paper_relationships_weight ON paper_relationships(weight DESC);

-- View: All adjacent papers for a given paper (both directions)
CREATE OR REPLACE VIEW paper_neighbors AS
SELECT
  paper_id_a AS source_paper_id,
  paper_id_b AS neighbor_paper_id,
  edge_type,
  weight,
  reasoning,
  'forward' AS direction
FROM paper_relationships
UNION ALL
SELECT
  paper_id_b AS source_paper_id,
  paper_id_a AS neighbor_paper_id,
  CASE
    WHEN edge_type IN ('semantic_similar', 'topic_overlap', 'contradicts') THEN edge_type
    WHEN edge_type = 'complementary' THEN 'complementary_reverse'
    WHEN edge_type = 'enables' THEN 'enables_reverse'
    WHEN edge_type = 'time_lag' THEN 'time_lag_reverse'
  END AS edge_type,
  weight,
  reasoning,
  'reverse' AS direction
FROM paper_relationships;

-- View: Graph statistics
CREATE OR REPLACE VIEW graph_statistics AS
SELECT
  COUNT(DISTINCT paper_id_a) + COUNT(DISTINCT paper_id_b) AS total_unique_papers,
  COUNT(*) AS total_edges,
  AVG(weight) AS avg_edge_weight,
  MAX(weight) AS max_edge_weight,
  MIN(weight) AS min_edge_weight
FROM paper_relationships;

COMMIT;
