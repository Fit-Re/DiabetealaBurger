import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { getReadingsSince, insertReading } from "../db/database";
import type { TrendArrow } from "../types";

// Cliente para la API no oficial de LibreLinkUp (la usada por la app "seguidor"
// de Abbott). Endpoints y comportamiento documentados por la comunidad de
// diabetes tipo 1 (proyectos como Nightscout/xDrip+ los usan desde hace años),
// NO por documentación oficial de Abbott. Puede cambiar o dejar de funcionar
// si Abbott modifica su API — si eso pasa, lo primero a revisar es LLU_VERSION.

const EMAIL_KEY = "librelinkup_email";
const PASSWORD_KEY = "librelinkup_password";
const REGION_KEY = "librelinkup_region";

const DEFAULT_HOST = "https://api.libreview.io";
const LLU_VERSION = "4.12.0";

export async function getStoredCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const email = await SecureStore.getItemAsync(EMAIL_KEY);
  const password = await SecureStore.getItemAsync(PASSWORD_KEY);
  if (!email || !password) return null;
  return { email, password };
}

export async function setStoredCredentials(
  email: string,
  password: string
): Promise<void> {
  await SecureStore.setItemAsync(EMAIL_KEY, email.trim());
  await SecureStore.setItemAsync(PASSWORD_KEY, password);
}

export async function clearStoredCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await SecureStore.deleteItemAsync(REGION_KEY);
}

function hostForRegion(region: string | null): string {
  if (!region) return DEFAULT_HOST;
  return `https://api-${region.toLowerCase()}.libreview.io`;
}

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";

function baseHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "cache-control": "no-cache",
    product: "llu.android",
    version: LLU_VERSION,
    "user-agent": MOBILE_USER_AGENT,
  };
}

const DIAGNOSTIC_RESPONSE_HEADERS = [
  "server",
  "cf-ray",
  "x-amzn-requestid",
  "x-amz-cf-id",
  "content-type",
];

async function readJsonWithDiagnostics(response: Response): Promise<any> {
  const bodyText = await response.text();
  let json: any = {};
  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { _rawText: bodyText };
  }
  json._httpStatus = response.status;
  json._ok = response.ok;
  const headerHints: string[] = [];
  for (const h of DIAGNOSTIC_RESPONSE_HEADERS) {
    const v = response.headers.get(h);
    if (v) headerHints.push(`${h}=${v}`);
  }
  json._headerHints = headerHints;
  return json;
}

function describeError(json: any, fallbackLabel: string): string {
  const detail =
    json?.message ||
    json?.error?.message ||
    (typeof json?.error === "string" ? json.error : null) ||
    json?._rawText;
  const status = json?._httpStatus;
  const hints = json?._headerHints?.length
    ? ` [${json._headerHints.join(", ")}]`
    : "";
  if (detail) return `${fallbackLabel} (${status}): ${detail}${hints}`;
  return `${fallbackLabel} (${status}). Abbott no dio más detalle en la respuesta.${hints}`;
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const char of padded) {
    if (char === "=") break;
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

async function loginAt(host: string, email: string, password: string): Promise<any> {
  const response = await fetch(`${host}/llu/auth/login`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const json = await readJsonWithDiagnostics(response);
  if (!response.ok) {
    throw new Error(describeError(json, "Error al iniciar sesión en LibreLinkUp"));
  }
  return json;
}

interface LoginResult {
  token: string;
  userId: string;
  region: string | null;
  jwtPayload: any;
}

async function login(email: string, password: string): Promise<LoginResult> {
  const cachedRegion = await SecureStore.getItemAsync(REGION_KEY);
  let region = cachedRegion;
  let host = hostForRegion(region);
  let json = await loginAt(host, email, password);

  if (json?.data?.redirect && json?.data?.region) {
    region = json.data.region as string;
    host = hostForRegion(region);
    json = await loginAt(host, email, password);
    await SecureStore.setItemAsync(REGION_KEY, region);
  }

  const step = json?.data?.step?.type;
  if (step && step !== "auth") {
    throw new Error(
      `Tu cuenta de LibreLinkUp requiere un paso adicional ("${step}") que la API no puede completar automáticamente — normalmente es aceptar Términos de Uso o Política de Privacidad actualizados. Abre la app oficial LibreLinkUp, inicia sesión ahí, acepta lo que te pida, y vuelve a intentar aquí.`
    );
  }

  const token = json?.data?.authTicket?.token;
  const userId = json?.data?.user?.id;
  if (!token || !userId) {
    throw new Error(
      `No se pudo iniciar sesión en LibreLinkUp. Revisa tu usuario y contraseña. Respuesta: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return { token, userId, region, jwtPayload: decodeJwtPayload(token) };
}

async function accountIdHeader(rawId: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawId);
}

async function tryConnectionsRequest(
  host: string,
  token: string,
  accountIdValue: string | null
): Promise<{ ok: boolean; json: any }> {
  const headers: Record<string, string> = {
    ...baseHeaders(),
    authorization: `Bearer ${token}`,
  };
  if (accountIdValue) headers["account-id"] = accountIdValue;
  const response = await fetch(`${host}/llu/connections`, { headers });
  const json = await readJsonWithDiagnostics(response);
  return { ok: response.ok, json };
}

export interface LibreLinkUpConnection {
  patientId: string;
  firstName: string;
  lastName: string;
}

interface ConnectionsResolution {
  accountIdValue: string | null;
  connections: LibreLinkUpConnection[];
}

async function resolveConnections(
  token: string,
  userId: string,
  region: string | null,
  _jwtPayload: any
): Promise<ConnectionsResolution> {
  const host = hostForRegion(region);
  const accountIdValue = await accountIdHeader(userId);
  const result = await tryConnectionsRequest(host, token, accountIdValue);

  if (!result.ok) {
    throw new Error(describeError(result.json, "Error al obtener conexiones"));
  }
  const data = result.json?.data ?? [];
  return {
    accountIdValue,
    connections: data.map((c: any) => ({
      patientId: c.patientId,
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
    })),
  };
}

function mapTrendArrow(code: number | null | undefined): TrendArrow {
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

function parseLibreTimestamp(ts: string): number | null {
  // Formato observado: "M/D/YYYY H:MM:SS AM/PM"
  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(ts.trim());
  if (!match) return null;
  const [, month, day, year, hours, minutes, seconds, meridiem] = match;
  let h = Number(hours) % 12;
  if (meridiem === "PM") h += 12;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    h,
    Number(minutes),
    Number(seconds)
  );
  return date.getTime();
}

interface LibreLinkUpReading {
  value: number;
  trend: TrendArrow;
  timestampMs: number;
}

function mapMeasurement(m: any): LibreLinkUpReading | null {
  const value = m?.ValueInMgPerDl ?? m?.Value;
  const timestampMs = m?.Timestamp ? parseLibreTimestamp(m.Timestamp) : null;
  if (typeof value !== "number" || timestampMs === null) return null;
  return {
    value,
    trend: mapTrendArrow(m?.TrendArrow),
    timestampMs,
  };
}

async function getGraphData(
  token: string,
  region: string | null,
  patientId: string,
  accountIdValue: string | null
): Promise<LibreLinkUpReading[]> {
  const host = hostForRegion(region);
  const headers: Record<string, string> = {
    ...baseHeaders(),
    authorization: `Bearer ${token}`,
  };
  if (accountIdValue) headers["account-id"] = accountIdValue;
  const response = await fetch(`${host}/llu/connections/${patientId}/graph`, { headers });
  const json = await readJsonWithDiagnostics(response);
  if (!response.ok) {
    throw new Error(describeError(json, "Error al obtener lecturas"));
  }
  const graphData: any[] = json?.data?.graphData ?? [];
  const latest = json?.data?.connection?.glucoseMeasurement;
  const all = [...graphData, latest].filter(Boolean);
  return all.map(mapMeasurement).filter((r): r is LibreLinkUpReading => r !== null);
}

async function insertReadingsDeduped(readings: LibreLinkUpReading[]): Promise<number> {
  if (readings.length === 0) return 0;
  const minTs = Math.min(...readings.map((r) => r.timestampMs));
  const existing = await getReadingsSince(minTs - 60_000);
  const existingKeys = new Set(
    existing
      .filter((r) => r.source === "librelink")
      .map((r) => `${Math.round(r.timestampMs / 60000)}:${r.value}`)
  );

  let inserted = 0;
  for (const r of readings) {
    const key = `${Math.round(r.timestampMs / 60000)}:${r.value}`;
    if (existingKeys.has(key)) continue;
    await insertReading({
      value: r.value,
      unit: "mg/dL",
      timestampMs: r.timestampMs,
      source: "librelink",
      trend: r.trend,
      notes: null,
    });
    existingKeys.add(key);
    inserted++;
  }
  return inserted;
}

export interface SyncResult {
  patientName: string;
  fetchedCount: number;
  importedCount: number;
}

export async function syncLibreLinkUp(): Promise<SyncResult> {
  const creds = await getStoredCredentials();
  if (!creds) {
    throw new Error("No hay credenciales de LibreLinkUp configuradas. Agrégalas en Ajustes.");
  }

  const { token, userId, region, jwtPayload } = await login(creds.email, creds.password);
  const { accountIdValue, connections } = await resolveConnections(
    token,
    userId,
    region,
    jwtPayload
  );
  if (connections.length === 0) {
    throw new Error(
      "Tu cuenta de LibreLinkUp no tiene ninguna conexión activa. Verifica que esté siguiendo tu sensor desde la app LibreLinkUp."
    );
  }

  const patient = connections[0];
  const readings = await getGraphData(token, region, patient.patientId, accountIdValue);
  const importedCount = await insertReadingsDeduped(readings);

  return {
    patientName: `${patient.firstName} ${patient.lastName}`.trim() || "Paciente",
    fetchedCount: readings.length,
    importedCount,
  };
}
