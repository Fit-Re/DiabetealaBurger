-- Patient Preferences: Personalize graph propagation & evidence filtering
-- Phase 3 Week 2: Allow patients to control evidence discovery experience

BEGIN;

CREATE TABLE IF NOT EXISTS patient_preferences (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL UNIQUE,

  -- Graph propagation preferences
  max_graph_depth INT NOT NULL DEFAULT 2 CHECK (max_graph_depth >= 1 AND max_graph_depth <= 3),

  -- Evidence filtering
  prefer_rct_only BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_evidence_level TEXT NOT NULL DEFAULT 'rct' CHECK (
    preferred_evidence_level IN ('rct', 'meta', 'observational')
  ),

  -- Topic exclusions: e.g., ARRAY['pumps', 'cgm'] to exclude pump/CGM papers
  exclude_topics TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Evidence language preferences
  preferred_languages TEXT[] DEFAULT ARRAY['es', 'en']::TEXT[],

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Index for fast lookups by patient
CREATE INDEX idx_patient_preferences_patient_id ON patient_preferences(patient_id);

-- RLS: Patients can only see/modify their own preferences
ALTER TABLE patient_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own preferences"
  ON patient_preferences FOR SELECT
  USING (patient_id = auth.uid()::text);

CREATE POLICY "Patients can insert own preferences"
  ON patient_preferences FOR INSERT
  WITH CHECK (patient_id = auth.uid()::text);

CREATE POLICY "Patients can update own preferences"
  ON patient_preferences FOR UPDATE
  USING (patient_id = auth.uid()::text)
  WITH CHECK (patient_id = auth.uid()::text);

COMMIT;
