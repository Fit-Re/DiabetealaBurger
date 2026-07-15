import { supabase } from "./supabase";

// Credenciales de LibreLinkUp/Ultrahuman para la sincronización automática
// server-side (Edge Function `sync-health-data` + cron cada hora, ver
// supabase/cron_setup.sql). Se guardan en la tabla `sync_credentials`:
// el cliente puede escribirlas/borrarlas pero nunca volver a leerlas (no
// hay GRANT de SELECT sobre la columna `credentials` para el rol
// `authenticated`, ver supabase/schema.sql) — solo el service_role que usa
// la Edge Function puede leerlas para sincronizar.

export type SyncService = "librelinkup" | "ultrahuman";

export interface SyncStatus {
  service: SyncService;
  updatedAtMs: number;
}

export async function saveLibreLinkUpCredentials(
  email: string,
  password: string
): Promise<void> {
  const { error } = await supabase.from("sync_credentials").upsert(
    { service: "librelinkup", credentials: { email: email.trim(), password } },
    { onConflict: "patient_id,service" }
  );
  if (error) throw new Error(error.message);
}

export async function saveUltrahumanCredentials(token: string): Promise<void> {
  const { error } = await supabase.from("sync_credentials").upsert(
    { service: "ultrahuman", credentials: { token: token.trim() } },
    { onConflict: "patient_id,service" }
  );
  if (error) throw new Error(error.message);
}

export async function clearSyncCredentials(service: SyncService): Promise<void> {
  const { error } = await supabase.from("sync_credentials").delete().eq("service", service);
  if (error) throw new Error(error.message);
}

export async function getSyncStatus(): Promise<Record<SyncService, SyncStatus | null>> {
  const { data, error } = await supabase
    .from("sync_credentials")
    .select("service,updated_at_ms");
  if (error) throw new Error(error.message);
  const byService: Record<SyncService, SyncStatus | null> = {
    librelinkup: null,
    ultrahuman: null,
  };
  for (const row of data ?? []) {
    byService[row.service as SyncService] = {
      service: row.service,
      updatedAtMs: row.updated_at_ms,
    };
  }
  return byService;
}

export interface SyncRun {
  service: SyncService;
  status: "success" | "error";
  importedCount: number;
  message: string | null;
  ranAtMs: number;
}

export async function getRecentSyncRuns(limit: number = 10): Promise<SyncRun[]> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("service,status,imported_count,message,ran_at_ms")
    .order("ran_at_ms", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    service: r.service,
    status: r.status,
    importedCount: r.imported_count,
    message: r.message,
    ranAtMs: r.ran_at_ms,
  }));
}

export interface TriggerSyncResult {
  synced: number;
  results: Array<{
    service: SyncService;
    importedCount?: number;
    message?: string;
    error?: string;
  }>;
}

export async function triggerSyncNow(): Promise<TriggerSyncResult> {
  const { data, error } = await supabase.functions.invoke("sync-health-data", {
    body: {},
  });
  if (error) throw new Error(error.message);
  return data as TriggerSyncResult;
}
