-- Migración incremental: sincronización automática (LibreLinkUp / Ultrahuman).
-- Pegar en Supabase Dashboard → SQL Editor → Run.
-- Seguro de correr en un proyecto que YA tiene schema.sql aplicado —
-- este archivo solo agrega tablas nuevas, no toca las existentes.
--
-- Después de correr esto: desplegar la Edge Function `sync-health-data`
-- (ver supabase/functions/sync-health-data/index.ts) y luego correr
-- supabase/cron_setup.sql para programar el sync cada hora.

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
