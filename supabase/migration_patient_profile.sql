-- Migración incremental: perfil de paciente persistente + historial de HbA1c.
-- Pegar en Supabase Dashboard → SQL Editor → Run.
-- Seguro de correr en un proyecto que YA tiene schema.sql aplicado —
-- este archivo solo agrega tablas nuevas, no toca las existentes.
--
-- Después de correr esto: la sección "Perfil de paciente" en Ajustes de la
-- app ya puede leer/escribir sobre estas tablas (falla en silencio, sin
-- romper el resto de la pantalla, si por algún motivo no se aplicó todavía).

-- ============================================================
-- PERFIL DE PACIENTE Y HbA1c
-- Perfil clínico persistente por paciente (rango objetivo, ratio
-- insulina:carbohidratos, factor de sensibilidad, zona horaria del sync) y su
-- historial de HbA1c. Alimentan el resto del pipeline (patterns.ts, la Edge
-- Function de sync) en vez de las constantes globales hardcodeadas anteriores.
-- ============================================================

create table if not exists patient_profile (
  patient_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  diabetes_type text not null default 'type1' check (diabetes_type in ('type1', 'type2', 'gestational', 'other')),
  diagnosis_year integer,
  target_range_low real not null default 70,
  target_range_high real not null default 180,
  insulin_carb_ratio real,        -- gramos de carbohidrato cubiertos por 1 unidad de insulina
  insulin_sensitivity_factor real, -- mg/dL de descenso por 1 unidad de insulina de corrección
  utc_offset_hours real not null default -6,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)
);

alter table patient_profile enable row level security;
create policy "patients manage own profile" on patient_profile
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- Historial de HbA1c, granularidad de evento (varias mediciones a través del tiempo).
create table if not exists hba1c_readings (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value_pct real not null,
  measured_at_ms bigint not null,
  notes text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_hba1c_patient on hba1c_readings (patient_id, measured_at_ms desc);

alter table hba1c_readings enable row level security;
create policy "patients manage own hba1c readings" on hba1c_readings
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
