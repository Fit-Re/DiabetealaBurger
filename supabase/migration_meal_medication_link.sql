-- Migración incremental: ligar una comida a la dosis de insulina bolo aplicada.
-- Pegar en Supabase Dashboard → SQL Editor → Run.
-- Seguro de correr en un proyecto que YA tiene schema.sql aplicado —
-- este archivo solo agrega una columna nullable a la tabla existente `meals`,
-- no borra ni modifica datos existentes.
--
-- Después de correr esto: al registrar una comida en la app se puede ligar
-- opcionalmente la dosis de bolo aplicada (últimas 6h), y el detector de
-- hiperglucemia post-comida (patterns.ts) puede distinguir la causa probable
-- (sin bolo / bolo insuficiente / otra causa) usando el ratio insulina:carb
-- del perfil del paciente.

-- ============================================================
-- COMIDA ↔ DOSIS DE MEDICAMENTO
-- Columna nullable que referencia el log de medicamento (dosis) asociado a la
-- comida. `on delete set null`: si se borra la dosis, la comida sobrevive con
-- el vínculo vaciado en vez de desaparecer.
-- ============================================================

alter table meals add column if not exists linked_medication_log_id bigint references medication_logs (id) on delete set null;
