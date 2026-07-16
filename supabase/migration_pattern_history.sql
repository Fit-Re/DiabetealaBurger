-- Migración incremental: historial de patrones detectados (memoria/tendencia).
-- Pegar en Supabase Dashboard → SQL Editor → Run.
-- Seguro de correr en un proyecto que YA tiene schema.sql aplicado —
-- este archivo solo agrega una tabla nueva, no toca las existentes.
--
-- Después de correr esto: `runPatternAnalysis` (src/lib/autoEnrich.ts) empieza a
-- persistir cada corrida, calcula tendencia semana a semana y dispara
-- notificaciones proactivas. Si NO se corre, el análisis degrada en silencio
-- (los patrones se muestran sin tendencia, sin romper el guardado del usuario).

-- ============================================================
-- HISTORIAL DE PATRONES
-- Calculado client-side (por eso default auth.uid(), a diferencia de sync_runs
-- que es solo service_role). Permite tendencia semana a semana y evita
-- re-notificar el mismo hallazgo repetidamente.
-- ============================================================

create table if not exists pattern_history (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern_id text not null,
  severity text not null check (severity in ('info', 'watch', 'attention')),
  evidence_count integer not null default 0,
  detected_at_ms bigint not null default (extract(epoch from now()) * 1000),
  window_start_ms bigint not null,
  window_end_ms bigint not null,
  notified boolean not null default false
);
create index if not exists idx_pattern_history_patient on pattern_history (patient_id, pattern_id, detected_at_ms desc);

alter table pattern_history enable row level security;
create policy "patients manage own pattern history" on pattern_history
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
