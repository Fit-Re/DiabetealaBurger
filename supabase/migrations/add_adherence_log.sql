-- Migración incremental: bitácora de cumplimiento diario.
-- Pegar en Supabase Dashboard → SQL Editor → Run.
-- Seguro de correr en un proyecto que YA tiene schema.sql aplicado —
-- este archivo solo agrega una tabla nueva, no toca las existentes.
--
-- Después de correr esto: la sección "Cambios aplicados" de la pantalla de
-- Tendencias ya puede leer/escribir sobre esta tabla. Mientras no se aplique,
-- la pantalla degrada sola (oculta la sección) sin romper el resto.

-- ============================================================
-- BITÁCORA DE CUMPLIMIENTO
-- Un registro por paciente y día. Guarda dos ejes independientes:
--   status: qué hizo el paciente con el ajuste acordado (se cumplió, no se
--           cumplió, o se aplicó modificado). Excluyentes entre sí.
--   mood:   cómo se sintió ese día. Es un eje aparte — sentirse bien o mal es
--           ortogonal a haber cumplido, así que no puede ser un status más.
-- ============================================================

create table if not exists adherence_log (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date_key text not null,           -- 'YYYY-MM-DD' local, para agrupar por día
  date_ms bigint not null,
  status text not null check (status in ('complied', 'not_complied', 'modified')),
  mood text check (mood in ('good', 'neutral', 'bad')),
  notes text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000),
  unique (patient_id, date_key)
);
create index if not exists idx_adherence_patient on adherence_log (patient_id, date_ms desc);

alter table adherence_log enable row level security;
create policy "patients manage own adherence" on adherence_log
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
