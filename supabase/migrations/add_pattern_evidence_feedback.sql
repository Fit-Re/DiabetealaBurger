-- Pattern Evidence Feedback: Track which papers help patients
-- Phase 3 Week 3: Enable ranking adjustment based on user feedback

BEGIN;

CREATE TABLE IF NOT EXISTS pattern_evidence_feedback (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,

  -- Links to pattern and paper
  pattern_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,

  -- User feedback: did this paper help?
  was_helpful BOOLEAN,  -- null = not rated yet, true/false = rated

  -- Action taken: what did patient do based on paper?
  action_taken TEXT,    -- e.g., "changed insulin dose", "improved sleep", null = no action

  -- Correlation: did following advice correlate with improvement?
  improvement_score INT CHECK (improvement_score >= -2 AND improvement_score <= 2),
  -- -2: Much worse, -1: Slightly worse, 0: No change, 1: Slightly better, 2: Much better

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  rated_at BIGINT,  -- When user provided feedback

  -- Prevent duplicate feedback
  CONSTRAINT unique_feedback UNIQUE (patient_id, pattern_id, paper_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_feedback_patient ON pattern_evidence_feedback(patient_id);
CREATE INDEX idx_feedback_pattern ON pattern_evidence_feedback(pattern_id);
CREATE INDEX idx_feedback_paper ON pattern_evidence_feedback(paper_id);
CREATE INDEX idx_feedback_helpful ON pattern_evidence_feedback(was_helpful) WHERE was_helpful IS NOT NULL;

-- RLS: patients can only see/modify their own feedback
ALTER TABLE pattern_evidence_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own feedback"
  ON pattern_evidence_feedback FOR SELECT
  USING (patient_id = auth.uid()::text);

CREATE POLICY "Patients can insert own feedback"
  ON pattern_evidence_feedback FOR INSERT
  WITH CHECK (patient_id = auth.uid()::text);

CREATE POLICY "Patients can update own feedback"
  ON pattern_evidence_feedback FOR UPDATE
  USING (patient_id = auth.uid()::text)
  WITH CHECK (patient_id = auth.uid()::text);

-- View: Summary of helpful papers per patient
CREATE OR REPLACE VIEW helpful_papers_summary AS
SELECT
  patient_id,
  paper_id,
  COUNT(*) AS feedback_count,
  SUM(CASE WHEN was_helpful THEN 1 ELSE 0 END) AS helpful_count,
  AVG(CAST(improvement_score AS FLOAT)) AS avg_improvement,
  ROUND(
    100.0 * SUM(CASE WHEN was_helpful THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    1
  )::INT AS helpful_percentage
FROM pattern_evidence_feedback
WHERE was_helpful IS NOT NULL
GROUP BY patient_id, paper_id;

COMMIT;
