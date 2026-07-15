-- Programa la sincronización automática cada hora.
-- Pegar en Supabase Dashboard → SQL Editor → Run, DESPUÉS de:
--   1. Haber corrido migration_sync_automation.sql (crea sync_credentials / sync_runs).
--   2. Haber desplegado la Edge Function `sync-health-data`
--      (ver supabase/functions/sync-health-data/index.ts).
--
-- Reemplazá el placeholder antes de correrlo:
--   <TU_SERVICE_ROLE_KEY>   → Project Settings → API → service_role (secret)
-- (el project ref ya está completado: dqulyugfmgvefjanjkee)
--
-- La service_role key queda guardada en la tabla interna cron.job de TU
-- propio proyecto — visible solo para quien tenga acceso de administrador
-- a este proyecto de Supabase (vos). No se comparte con nadie más al
-- correr este script.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'sync-health-data-hourly',
  '0 * * * *', -- cada hora en punto
  $$
  select net.http_post(
    url := 'https://dqulyugfmgvefjanjkee.supabase.co/functions/v1/sync-health-data',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <TU_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para revisar que el cron job quedó creado:
--   select * from cron.job;
-- Para ver el historial de corridas del cron (no confundir con la tabla
-- sync_runs de la app, esto es a nivel de infraestructura de Postgres):
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Para borrarlo si algo sale mal:
--   select cron.unschedule('sync-health-data-hourly');
