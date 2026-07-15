-- DiabetealaBurger — esquema Supabase (Postgres)
-- Pegar completo en Supabase Dashboard → SQL Editor → Run

-- ============================================================
-- TABLAS PRIVADAS POR PACIENTE
-- Cada fila pertenece a un patient_id (= auth.users.id).
-- RLS asegura que un paciente solo pueda leer/escribir sus propias filas.
-- ============================================================

create table if not exists glucose_readings (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value real not null,
  unit text not null,
  timestamp_ms bigint not null,
  source text not null,
  trend text,
  notes text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_readings_patient_timestamp on glucose_readings (patient_id, timestamp_ms desc);

create table if not exists medications (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  dose_amount real,
  dose_unit text,
  schedule_times jsonb not null default '[]',
  notes text,
  active boolean not null default true,
  notification_ids jsonb not null default '[]',
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_medications_patient on medications (patient_id);

create table if not exists medication_logs (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medication_id bigint not null references medications (id) on delete cascade,
  taken_at_ms bigint not null,
  dose_amount real,
  notes text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_medication_logs_patient_taken on medication_logs (patient_id, taken_at_ms desc);

create table if not exists meals (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timestamp_ms bigint not null,
  description text,
  calories real,
  carbs_g real,
  sugar_g real,
  protein_g real,
  fat_g real,
  portion_estimate text,
  items jsonb not null default '[]',
  source text not null,
  ai_notes text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_meals_patient_timestamp on meals (patient_id, timestamp_ms desc);

create table if not exists lifestyle_metrics (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date_key text not null,
  date_ms bigint not null,
  source text not null,
  sleep_score real,
  sleep_duration_min real,
  hrv_ms real,
  resting_heart_rate real,
  recovery_index real,
  temp_deviation_c real,
  steps integer,
  vo2_max real,
  raw text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000),
  unique (patient_id, date_key, source)
);
create index if not exists idx_lifestyle_metrics_patient_date on lifestyle_metrics (patient_id, date_ms desc);

alter table glucose_readings enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table meals enable row level security;
alter table lifestyle_metrics enable row level security;

create policy "patients manage own glucose readings" on glucose_readings
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create policy "patients manage own medications" on medications
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create policy "patients manage own medication logs" on medication_logs
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create policy "patients manage own meals" on meals
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create policy "patients manage own lifestyle metrics" on lifestyle_metrics
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- ============================================================
-- BASE DE CONOCIMIENTO COMPARTIDA
-- Visible y enriquecible por cualquier paciente autenticado.
-- No lleva patient_id: la evidencia científica no es de nadie en particular.
-- ============================================================

create table if not exists knowledge_chunks (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  authors text not null,
  year integer,
  source text not null,
  url text,
  topic text not null,
  text text not null,
  embedding jsonb not null,
  curated boolean not null default true,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);

alter table knowledge_chunks enable row level security;

create policy "any authenticated user can read knowledge" on knowledge_chunks
  for select using (auth.role() = 'authenticated');

create policy "any authenticated user can add knowledge" on knowledge_chunks
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- SINCRONIZACIÓN AUTOMÁTICA (LibreLinkUp / Ultrahuman) — server-side
-- Las credenciales de terceros viven acá para que una Edge Function con
-- cron pueda sincronizar sin depender de que el celular esté abierto.
-- Protección: cifrado en reposo estándar de Postgres/Supabase + RLS por
-- patient_id — ningún otro paciente ni el rol anónimo puede ver esta
-- tabla. La app nunca pide de vuelta la columna `credentials` (solo lee
-- `service`/`updated_at_ms` para mostrar el estado), pero a nivel de base
-- de datos el dueño de la fila SÍ podría releer su propia contraseña con
-- una consulta directa a la API (una restricción de columna más estricta
-- rompía el upsert: Postgres necesita poder confirmar de vuelta la fila
-- que acaba de escribir). Esto NO es cifrado de extremo a extremo: alguien
-- con acceso de administrador a este proyecto de Supabase podría leer las
-- credenciales en texto plano vía SQL directo con privilegios elevados.
-- ============================================================

create table if not exists sync_credentials (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service text not null check (service in ('librelinkup', 'ultrahuman')),
  credentials jsonb not null,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000),
  unique (patient_id, service)
);

alter table sync_credentials enable row level security;

create policy "patients manage own sync credentials" on sync_credentials
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- Historial de corridas de sync (sin datos sensibles) — el paciente puede
-- verlo para saber cuándo sincronizó por última vez y si hubo errores.
-- Solo la Edge Function (service_role) inserta filas acá.
create table if not exists sync_runs (
  id bigint generated always as identity primary key,
  patient_id uuid not null references auth.users (id) on delete cascade,
  service text not null,
  status text not null check (status in ('success', 'error')),
  imported_count integer not null default 0,
  message text,
  ran_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_sync_runs_patient on sync_runs (patient_id, ran_at_ms desc);

alter table sync_runs enable row level security;

create policy "patients read own sync runs" on sync_runs
  for select using (auth.uid() = patient_id);
