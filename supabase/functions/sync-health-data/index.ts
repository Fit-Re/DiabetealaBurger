// Sincroniza LibreLinkUp y Ultrahuman para uno o todos los pacientes.
//
// Dos modos, elegidos automáticamente según el Authorization header:
//   - service_role (usado por el cron job, ver ../../cron_setup.sql):
//     sincroniza TODOS los pacientes con credenciales guardadas.
//   - JWT de un usuario normal (usado por el botón "Sincronizar ahora" de
//     la app, vía supabase.functions.invoke): sincroniza solo ese paciente.
//
// Deploy: supabase functions deploy sync-health-data --no-verify-jwt
// (--no-verify-jwt porque este archivo valida el token él mismo, para
// poder distinguir service_role de un usuario normal en vez de que el
// runtime lo rechace antes de llegar acá).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Retry configuration for transient network/API errors
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_MULTIPLIER = 2;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isTransientError(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!isTransientError(response.status)) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status} (transient, attempt ${attempt + 1}/${maxRetries + 1})`);
        if (attempt === maxRetries) {
          return response;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      lastError =
        e instanceof Error
          ? new Error(`Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${e.message}`)
          : new Error(`Network error (attempt ${attempt + 1}/${maxRetries + 1})`);

      if (attempt === maxRetries) {
        throw lastError;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, 32_000);
  }

  throw lastError || new Error("Fetch failed after retries");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function decodeJwtPayload(token: string): any {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const payload = token ? decodeJwtPayload(token) : null;
  const isServiceRole = payload?.role === "service_role";
  const callingPatientId = !isServiceRole ? payload?.sub ?? null : null;

  if (!isServiceRole && !callingPatientId) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let credsQuery = admin.from("sync_credentials").select("*");
  if (!isServiceRole) credsQuery = credsQuery.eq("patient_id", callingPatientId);
  const { data: credRows, error: credErr } = await credsQuery;
  if (credErr) return jsonResponse({ error: credErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const row of credRows ?? []) {
    try {
      const result =
        row.service === "librelinkup"
          ? await syncLibreLinkUpForPatient(admin, row.patient_id, row.credentials)
          : await syncUltrahumanForPatient(
              admin,
              row.patient_id,
              row.credentials,
              await getUtcOffsetHoursForPatient(admin, row.patient_id)
            );
      await admin.from("sync_runs").insert({
        patient_id: row.patient_id,
        service: row.service,
        status: "success",
        imported_count: result.importedCount,
        message: result.message ?? null,
      });
      results.push({ patientId: row.patient_id, service: row.service, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin.from("sync_runs").insert({
        patient_id: row.patient_id,
        service: row.service,
        status: "error",
        imported_count: 0,
        message,
      });
      results.push({ patientId: row.patient_id, service: row.service, error: message });
    }
  }

  return jsonResponse({ synced: results.length, results });
});

// Zona horaria de la paciente para el cálculo de "día calendario" del sync de
// Ultrahuman (ver dateKeyDaysAgo/dateKeyToMs más abajo). Antes era una
// constante fija del módulo (-6, hora de México); ahora se lee del perfil de
// cada paciente (patient_profile.utc_offset_hours), con el mismo -6 como
// fallback si el paciente no tiene perfil creado todavía o si la tabla
// patient_profile no existe aún (proyecto sin la migración correspondiente
// aplicada) — nunca debe tronar el sync completo por esto.
const FALLBACK_UTC_OFFSET_HOURS = -6;

async function getUtcOffsetHoursForPatient(admin: SupabaseClient, patientId: string): Promise<number> {
  try {
    const { data, error } = await admin
      .from("patient_profile")
      .select("utc_offset_hours")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (error) return FALLBACK_UTC_OFFSET_HOURS;
    return data?.utc_offset_hours ?? FALLBACK_UTC_OFFSET_HOURS;
  } catch {
    return FALLBACK_UTC_OFFSET_HOURS;
  }
}

// ============================================================
// LibreLinkUp — puerto de src/lib/librelinkup.ts (misma API no oficial)
// ============================================================

const LLU_HOST = "https://api.libreview.io";
const LLU_VERSION = "4.16.0";
const LLU_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";

function lluHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "cache-control": "no-cache",
    product: "llu.android",
    version: LLU_VERSION,
    "user-agent": LLU_USER_AGENT,
  };
}

function lluHostForRegion(region: string | null): string {
  if (!region) return LLU_HOST;
  return `https://api-${region.toLowerCase()}.libreview.io`;
}

async function lluLoginAt(host: string, email: string, password: string): Promise<any> {
  const response = await fetchWithRetry(`${host}/llu/auth/login`, {
    method: "POST",
    headers: lluHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || `Error al iniciar sesión en LibreLinkUp (${response.status})`);
  }
  return json;
}

async function lluLogin(email: string, password: string) {
  let region: string | null = null;
  let host = lluHostForRegion(region);
  let json = await lluLoginAt(host, email, password);

  if (json?.data?.redirect && json?.data?.region) {
    region = json.data.region;
    host = lluHostForRegion(region);
    json = await lluLoginAt(host, email, password);
  }

  const step = json?.data?.step?.type;
  if (step && step !== "auth") {
    throw new Error(
      `Tu cuenta de LibreLinkUp requiere un paso adicional ("${step}") en la app oficial (aceptar Términos/Privacidad actualizados).`
    );
  }

  const token = json?.data?.authTicket?.token;
  const userId = json?.data?.user?.id;
  if (!token || !userId) {
    throw new Error("No se pudo iniciar sesión en LibreLinkUp. Revisa usuario y contraseña.");
  }
  return { token, userId, region };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mapTrendArrow(code: number | null | undefined): string | null {
  switch (code) {
    case 1:
      return "falling_fast";
    case 2:
      return "falling";
    case 3:
      return "steady";
    case 4:
      return "rising";
    case 5:
      return "rising_fast";
    default:
      return null;
  }
}

// Abbott manda dos marcas de tiempo por lectura: `Timestamp` (hora local
// de la cuenta LibreLinkUp) y `FactoryTimestamp` (la misma hora, en UTC).
// El cliente RN original usaba `Timestamp` interpretándolo con el huso
// horario del teléfono — válido porque coincide con el de la paciente.
// Acá, corriendo en el servidor (Deno/Supabase, huso horario UTC), hacer
// lo mismo interpretaría "8:00 PM hora de México" como "8:00 PM UTC",
// desfasando cada lectura ~6-7h y rompiendo a qué día calendario
// pertenece. Por eso usamos `FactoryTimestamp` y lo parseamos como UTC
// explícito con Date.UTC — así el resultado no depende del huso horario
// de dónde corra el código.
function parseLibreTimestampUTC(ts: string): number | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(ts.trim());
  if (!match) return null;
  const [, month, day, year, hours, minutes, seconds, meridiem] = match;
  let h = Number(hours) % 12;
  if (meridiem === "PM") h += 12;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), h, Number(minutes), Number(seconds));
}

function mapMeasurement(m: any): { value: number; trend: string | null; timestampMs: number } | null {
  const value = m?.ValueInMgPerDl ?? m?.Value;
  const timestampMs = m?.FactoryTimestamp ? parseLibreTimestampUTC(m.FactoryTimestamp) : null;
  if (typeof value !== "number" || timestampMs === null) return null;
  return { value, trend: mapTrendArrow(m?.TrendArrow), timestampMs };
}

async function syncLibreLinkUpForPatient(
  admin: SupabaseClient,
  patientId: string,
  creds: { email?: string; password?: string }
): Promise<{ importedCount: number; message: string }> {
  if (!creds?.email || !creds?.password) throw new Error("Credenciales de LibreLinkUp incompletas.");

  const { token, userId, region } = await lluLogin(creds.email, creds.password);
  const host = lluHostForRegion(region);
  const accountIdValue = await sha256Hex(userId);

  const connResponse = await fetchWithRetry(`${host}/llu/connections`, {
    headers: { ...lluHeaders(), authorization: `Bearer ${token}`, "account-id": accountIdValue },
  });
  const connJson = await connResponse.json().catch(() => ({}));
  if (!connResponse.ok) {
    const statusText = connResponse.status === 403 ? "Forbidden (invalid credentials or API version)" : "";
    throw new Error(
      connJson?.message || `Error al obtener conexiones (${connResponse.status}) ${statusText}`.trim()
    );
  }
  const connections = connJson?.data ?? [];
  if (connections.length === 0) {
    throw new Error("La cuenta de LibreLinkUp no tiene conexiones activas.");
  }
  const patient = connections[0];

  const graphResponse = await fetchWithRetry(`${host}/llu/connections/${patient.patientId}/graph`, {
    headers: { ...lluHeaders(), authorization: `Bearer ${token}`, "account-id": accountIdValue },
  });
  const graphJson = await graphResponse.json().catch(() => ({}));
  if (!graphResponse.ok) {
    throw new Error(graphJson?.message || `Error al obtener lecturas (${graphResponse.status})`);
  }
  const graphData: any[] = graphJson?.data?.graphData ?? [];
  const latest = graphJson?.data?.connection?.glucoseMeasurement;
  const readings = [...graphData, latest]
    .filter(Boolean)
    .map(mapMeasurement)
    .filter((r): r is { value: number; trend: string | null; timestampMs: number } => r !== null);

  if (readings.length === 0) {
    return { importedCount: 0, message: "Sin lecturas nuevas de LibreLinkUp." };
  }

  const minTs = Math.min(...readings.map((r) => r.timestampMs));
  const { data: existing } = await admin
    .from("glucose_readings")
    .select("timestamp_ms, value")
    .eq("patient_id", patientId)
    .eq("source", "librelink")
    .gte("timestamp_ms", minTs - 60_000);
  const existingKeys = new Set(
    (existing ?? []).map((r: any) => `${Math.round(r.timestamp_ms / 60000)}:${r.value}`)
  );

  const toInsert = readings.filter((r) => {
    const key = `${Math.round(r.timestampMs / 60000)}:${r.value}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (toInsert.length > 0) {
    const { error } = await admin.from("glucose_readings").insert(
      toInsert.map((r) => ({
        patient_id: patientId,
        value: r.value,
        unit: "mg/dL",
        timestamp_ms: r.timestampMs,
        source: "librelink",
        trend: r.trend,
        notes: null,
      }))
    );
    if (error) throw new Error(error.message);
  }

  return {
    importedCount: toInsert.length,
    message: `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || "Paciente",
  };
}

// ============================================================
// Ultrahuman — puerto de src/lib/ultrahuman.ts
// ============================================================

const UH_BASE_URL = "https://partner.ultrahuman.com/api/v1";
const UH_DAYS_BACK = 7; // igualar la ventana que la propia Ultrahuman ofrece

// El servidor corre en UTC, pero "hoy" tiene que ser el día calendario de
// la paciente — si usáramos el reloj del servidor tal cual, entre el
// anochecer y medianoche hora local el servidor ya estaría "en el día
// siguiente" y pediría/guardaría la fecha equivocada. `utcOffsetHours` viene
// del perfil de cada paciente (ver getUtcOffsetHoursForPatient arriba),
// fallback -6 (México, CST, sin horario de verano desde 2022).
function dateKeyDaysAgo(daysAgo: number, utcOffsetHours: number): string {
  const localMs = Date.now() + utcOffsetHours * 3600_000 - daysAgo * 86_400_000;
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyToMs(dateKey: string, utcOffsetHours: number): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  // Medianoche en hora local de la paciente, expresada como instante UTC,
  // para que el teléfono (en esa misma hora local) la muestre el día correcto.
  return Date.UTC(year, month - 1, day) - utcOffsetHours * 3600_000;
}

function findMetricObject(metricData: any[], typeNames: string[]): any | null {
  const found = metricData.find(
    (m) => typeof m?.type === "string" && typeNames.includes(m.type.toLowerCase())
  );
  return found?.object ?? null;
}

function findNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && !Number.isNaN(value)) return value;
  }
  return null;
}

function normalizeUltrahumanMetrics(raw: any, dateKey: string) {
  const metricData: any[] = Array.isArray(raw?.data?.metrics?.[dateKey]) ? raw.data.metrics[dateKey] : [];
  const sleep = findMetricObject(metricData, ["sleep"]);
  const avgSleepHrv = findMetricObject(metricData, ["avg_sleep_hrv"]);
  const hrv = findMetricObject(metricData, ["hrv"]);
  const sleepRhr = findMetricObject(metricData, ["sleep_rhr"]);
  const nightRhr = findMetricObject(metricData, ["night_rhr"]);
  const recovery = findMetricObject(metricData, ["recovery_index"]);
  const steps = findMetricObject(metricData, ["steps"]);
  const vo2 = findMetricObject(metricData, ["vo2_max"]);

  return {
    sleepScore: findNumber(sleep?.sleep_score, ["score"]),
    sleepDurationMin: findNumber(sleep?.total_sleep, ["minutes"]),
    hrvMs: findNumber(avgSleepHrv, ["value"]) ?? findNumber(hrv, ["avg", "value"]),
    restingHeartRate: findNumber(sleepRhr, ["value"]) ?? findNumber(nightRhr, ["avg", "value"]),
    recoveryIndex: findNumber(recovery, ["value"]),
    tempDeviationC: findNumber(sleep?.temperature_deviation, ["celsius"]),
    steps: findNumber(steps, ["total", "value"]),
    vo2Max: findNumber(vo2, ["value"]),
  };
}

async function syncUltrahumanForPatient(
  admin: SupabaseClient,
  patientId: string,
  creds: { token?: string },
  utcOffsetHours: number
): Promise<{ importedCount: number; message: string }> {
  if (!creds?.token) throw new Error("Falta el token de Ultrahuman.");

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < UH_DAYS_BACK; i++) {
    const dateKey = dateKeyDaysAgo(i, utcOffsetHours);
    try {
      const response = await fetchWithRetry(`${UH_BASE_URL}/partner/daily_metrics?date=${dateKey}`, {
        headers: { Authorization: creds.token, "content-type": "application/json" },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.error) {
        throw new Error(json?.error || json?.message || `HTTP ${response.status}`);
      }
      const normalized = normalizeUltrahumanMetrics(json, dateKey);
      const { error } = await admin.from("lifestyle_metrics").upsert(
        {
          patient_id: patientId,
          date_key: dateKey,
          date_ms: dateKeyToMs(dateKey, utcOffsetHours),
          source: "ultrahuman",
          sleep_score: normalized.sleepScore,
          sleep_duration_min: normalized.sleepDurationMin,
          hrv_ms: normalized.hrvMs,
          resting_heart_rate: normalized.restingHeartRate,
          recovery_index: normalized.recoveryIndex,
          temp_deviation_c: normalized.tempDeviationC,
          steps: normalized.steps,
          vo2_max: normalized.vo2Max,
          raw: JSON.stringify(json),
        },
        { onConflict: "patient_id,date_key,source" }
      );
      if (error) throw new Error(error.message);
      imported++;
    } catch (e) {
      errors.push(`${dateKey}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (imported === 0 && errors.length > 0) throw new Error(errors.join(" | "));
  return {
    importedCount: imported,
    message: errors.length > 0 ? errors.join(" | ") : `${imported} días actualizados.`,
  };
}
