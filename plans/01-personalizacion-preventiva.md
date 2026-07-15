# Plan: Pipeline de datos personalizado para intervenciones preventivas

**Origen**: auditoría completa del pipeline de datos (recolección → almacenamiento → análisis de patrones → enriquecimiento → reporte), sesión del 2026-07-15. Este plan ataca los 3 cuellos de botella prioritarios identificados, en orden de dependencia: perfil de paciente → correlación insulina-comida-glucosa → motor de patrones con memoria/tendencia.

Ejecutar con `/do`, una fase a la vez, en contextos nuevos si hace falta — cada fase es autocontenida.

---

## Fase 0: Documentation Discovery (ya realizada, consolidada aquí)

### APIs y patrones permitidos (citados, no inventados)

**Definición de tabla nueva** — plantilla exacta (`supabase/schema.sql:23-36`, tabla `medications`):
```sql
create table if not exists <tabla> (
  id bigint generated always as identity primary key,
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ...
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_<tabla>_patient on <tabla> (patient_id);

alter table <tabla> enable row level security;
create policy "patients manage own <tabla>" on <tabla>
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
```
- Timestamps siempre `bigint` epoch-ms, nunca `timestamptz`.
- Arrays/objetos: `jsonb not null default '[]'`.
- **NUNCA agregar GRANT/REVOKE a nivel de columna** — ya causó un bug de "permission denied" (ver `schema.sql:138-151`, comentario de trade-off aceptado). Usar solo `for all using (...) with check (...)`.
- Tabla de una sola fila por paciente (como `patient_profile`): usar `patient_id uuid primary key references auth.users(id) on delete cascade` en vez de `id bigint identity` — es una desviación intencional válida.
- Tabla escrita solo por Edge Function (`service_role`), como `sync_runs` (`schema.sql:170-184`): `patient_id` **sin** `default auth.uid()`, policy `for select` únicamente.

**Migración incremental**: crear `supabase/migration_<nombre>.sql` standalone (no diff), con cabecera calcada de `migration_sync_automation.sql:1-8`, usando `if not exists` en todo para idempotencia. Además agregar el mismo bloque a `schema.sql` para instalaciones nuevas.

**CRUD en `src/db/database.ts`** — patrón exacto:
```ts
interface XRow { /* snake_case, refleja columnas DB */ }
function mapXRow(row: XRow): X { /* camelCase */ }

export async function insertX(x: NewX): Promise<number> {
  const result = await supabase.from("x").insert({...}).select("id").single();
  return unwrap(result).id;
}
export async function getX(): Promise<X[]> {
  const result = await supabase.from("x").select("*").order("created_at_ms", { ascending: false });
  return unwrap<XRow[]>(result).map(mapXRow);
}
```
- Nunca se pasa `patient_id` explícito en insert/update — se apoya en `default auth.uid()` + RLS.
- Update simple: `const { error } = await supabase.from("x").update({...}).eq("id", id); if (error) throw new Error(error.message);` (`database.ts:200-209`).
- Upsert de fila única: `.upsert({...}, { onConflict: "patient_id" })` (análogo a `database.ts:438-459` que usa `"patient_id,date_key,source"`).

**Tipos en `src/types/index.ts`**: patrón `X` (dominio, camelCase) + `NewX` (omite `id`/`createdAtMs`/campos con default server-side), ver `Medication`/`NewMedication` (líneas 71-91). `TARGET_RANGE` vive en líneas 43-46.

**Selector de fecha/hora retroactiva** — patrón exacto a copiar (`AddReadingScreen.tsx:32-43, 51-54, 90-121`):
```ts
const [dateTime, setDateTime] = useState(() => new Date());
const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
const openPicker = (mode: "date" | "time") => setPickerMode(mode);
const onPickerChange = (event: { type: string }, selected?: Date) => {
  if (Platform.OS === "android") setPickerMode(null);
  if (event.type === "dismissed" || !selected) return;
  setDateTime((prev) => pickerMode === "date" ? mergeDatePart(prev, selected) : mergeTimePart(prev, selected));
};
// validación anti-futuro (doble capa): maximumDate={new Date()} en el picker + chequeo explícito antes de guardar
if (dateTime.getTime() > Date.now()) { Alert.alert("Fecha inválida", "..."); return; }
```
Utilidades ya existentes en `src/lib/dateTimeUtils.ts` (40 líneas, completo): `mergeDatePart`, `mergeTimePart`, `formatDate`, `formatTime`, `startOfDay`, `addDays`, `isSameDay` — no reinventar.

**`src/lib/patterns.ts`** (332 líneas, completo): `detectPatterns()` orquestadora (líneas 291-331) arma un array de 7 detectores + `.filter(non-null)` + `.sort()` por `severityOrder`. Es **100% stateless** — no hay ningún campo de fecha/ventana en `PatternFinding` (`types/index.ts:228-235`: solo `id, title, description, severity, suggestedQuery, evidenceCount`). `detectDawnPhenomenon` (45-83) y `detectNocturnalHypoglycemia` (85-106) son independientes hoy, ambas usan `dayKeyOf()`/`hourOf()` (36-43).

**`src/lib/autoEnrich.ts`** (58 líneas, completo): patrón fire-and-forget — `try { ... } catch { /* silencioso */ }`, llamado **sin `await`** desde `AddReadingScreen.tsx:70` y `MealsScreen.tsx:183`, justo después del `Alert.alert` de éxito.

**`src/lib/notifications.ts`** (56 líneas, completo): `expo-notifications` ya instalado y configurado. Hoy solo soporta triggers `CALENDAR` recurrentes (`scheduleMedicationReminders`, líneas 20-48). **No hay precedente de notificación inmediata disparada por evento** — confirmar contra doc versionada de Expo SDK v57 (`AGENTS.md` exige esto explícitamente: "Expo HAS CHANGED — Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/").

### Anti-patrones a evitar
- No inventar columnas SQL sin `if not exists` / sin seguir el tipo `bigint` epoch-ms.
- No agregar GRANT/REVOKE a nivel de columna.
- No asumir que `expo-notifications` soporta trigger inmediato sin verificar la doc v57 primero.
- No tocar la firma pública de `detectPatterns()` sin revisar todos sus llamadores (`HomeScreen.tsx`, `autoEnrich.ts`).
- No crear una migración que modifique tablas existentes con `alter table` destructivo sin `if not exists`/columnas nullable con default.

---

## Fase 1: Perfil de paciente persistente

**Objetivo**: reemplazar el `TARGET_RANGE` global y el `PATIENT_UTC_OFFSET_HOURS = -6` hardcodeado por un perfil real por paciente que alimente el resto del sistema.

### 1.1 Schema

Agregar a `supabase/schema.sql` (y crear `supabase/migration_patient_profile.sql` idéntico con cabecera de migración incremental):

```sql
-- Perfil clínico del paciente: una fila por paciente, alimenta rango objetivo,
-- ratio insulina:carbohidratos, factor de sensibilidad y zona horaria del sync.
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
```

Verificación: correr en Supabase SQL Editor, confirmar con `select * from patient_profile;` y `select * from hba1c_readings;` que ambas existen y RLS está activo (`select * from pg_policies where tablename in ('patient_profile', 'hba1c_readings');`).

### 1.2 Tipos (`src/types/index.ts`)

Agregar junto a `TARGET_RANGE` (línea 43-46), siguiendo el patrón `X`/`NewX` de `Medication` (líneas 71-91):

```ts
export type DiabetesType = "type1" | "type2" | "gestational" | "other";

export interface PatientProfile {
  diabetesType: DiabetesType;
  diagnosisYear: number | null;
  targetRangeLow: number;
  targetRangeHigh: number;
  insulinCarbRatio: number | null;
  insulinSensitivityFactor: number | null;
  utcOffsetHours: number;
  updatedAtMs: number;
}

export interface PatientProfileUpdate {
  diabetesType?: DiabetesType;
  diagnosisYear?: number | null;
  targetRangeLow?: number;
  targetRangeHigh?: number;
  insulinCarbRatio?: number | null;
  insulinSensitivityFactor?: number | null;
  utcOffsetHours?: number;
}

export interface Hba1cReading {
  id: number;
  valuePct: number;
  measuredAtMs: number;
  notes: string | null;
  createdAtMs: number;
}

export interface NewHba1cReading {
  valuePct: number;
  measuredAtMs: number;
  notes: string | null;
}
```

No borrar `TARGET_RANGE` todavía (paso de compatibilidad dentro de esta misma fase, ver 1.4) — se elimina al final de la fase una vez que todos los usos estén migrados.

### 1.3 `src/db/database.ts`

Copiar el patrón de upsert de fila única (`onConflict: "patient_id"`) y el patrón CRUD estándar:

```ts
interface PatientProfileRow {
  patient_id: string;
  diabetes_type: DiabetesType;
  diagnosis_year: number | null;
  target_range_low: number;
  target_range_high: number;
  insulin_carb_ratio: number | null;
  insulin_sensitivity_factor: number | null;
  utc_offset_hours: number;
  updated_at_ms: number;
}

function mapPatientProfileRow(row: PatientProfileRow): PatientProfile {
  return {
    diabetesType: row.diabetes_type,
    diagnosisYear: row.diagnosis_year,
    targetRangeLow: row.target_range_low,
    targetRangeHigh: row.target_range_high,
    insulinCarbRatio: row.insulin_carb_ratio,
    insulinSensitivityFactor: row.insulin_sensitivity_factor,
    utcOffsetHours: row.utc_offset_hours,
    updatedAtMs: row.updated_at_ms,
  };
}

export async function getPatientProfile(): Promise<PatientProfile | null> {
  const { data, error } = await supabase.from("patient_profile").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPatientProfileRow(data as PatientProfileRow) : null;
}

export async function upsertPatientProfile(update: PatientProfileUpdate): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (update.diabetesType !== undefined) payload.diabetes_type = update.diabetesType;
  if (update.diagnosisYear !== undefined) payload.diagnosis_year = update.diagnosisYear;
  if (update.targetRangeLow !== undefined) payload.target_range_low = update.targetRangeLow;
  if (update.targetRangeHigh !== undefined) payload.target_range_high = update.targetRangeHigh;
  if (update.insulinCarbRatio !== undefined) payload.insulin_carb_ratio = update.insulinCarbRatio;
  if (update.insulinSensitivityFactor !== undefined) payload.insulin_sensitivity_factor = update.insulinSensitivityFactor;
  if (update.utcOffsetHours !== undefined) payload.utc_offset_hours = update.utcOffsetHours;
  payload.updated_at_ms = Date.now();

  const { error } = await supabase.from("patient_profile").upsert(payload, { onConflict: "patient_id" });
  if (error) throw new Error(error.message);
}

export async function insertHba1cReading(reading: NewHba1cReading): Promise<number> {
  const result = await supabase.from("hba1c_readings").insert({
    value_pct: reading.valuePct,
    measured_at_ms: reading.measuredAtMs,
    notes: reading.notes,
  }).select("id").single();
  return unwrap(result).id;
}

export async function getHba1cReadingsSince(sinceMs: number): Promise<Hba1cReading[]> {
  const result = await supabase.from("hba1c_readings").select("*")
    .gte("measured_at_ms", sinceMs).order("measured_at_ms", { ascending: false });
  return unwrap<any[]>(result).map((row) => ({
    id: row.id, valuePct: row.value_pct, measuredAtMs: row.measured_at_ms,
    notes: row.notes, createdAtMs: row.created_at_ms,
  }));
}
```

`maybeSingle()` (no `.single()`) porque el perfil puede no existir aún para un paciente nuevo — verificar que este método existe en la versión de `@supabase/supabase-js` instalada (`grep '"@supabase/supabase-js"' package.json`) antes de usarlo; si no existe, usar `.select("*").limit(1)` y tomar `data?.[0]`.

### 1.4 Migrar usos de `TARGET_RANGE`

- `src/db/database.ts:109-113` (`computeStats`): en vez de importar `TARGET_RANGE` como default, los llamadores (`HomeScreen.tsx`) deben pasar `profile.targetRangeLow`/`targetRangeHigh` explícitos. Cargar el perfil una vez en `HomeScreen` (`useFocusEffect`, junto a las demás cargas) y pasarlo a `computeStats` y a `detectPatterns` (ver Fase 3).
- `src/lib/patterns.ts:90` (`detectNocturnalHypoglycemia`, usa `TARGET_RANGE.low`): cambiar la firma para recibir `targetLow: number` como parámetro en vez de importar la constante global. Actualizar el único llamador en `detectPatterns()` (línea 303) para pasar `readings, targetLow`.
- Una vez migrados ambos usos, eliminar `TARGET_RANGE` de `types/index.ts:43-46` (o dejarlo como fallback documentado `DEFAULT_TARGET_RANGE` para pacientes sin perfil aún creado — recomendado, más seguro que un breaking change).

### 1.5 UI de perfil (`SettingsScreen.tsx`)

Nueva sección `PatientProfileSection`, copiando el esqueleto de `AutoSyncSection` (líneas 150-339: estado local por campo, `refresh()` en `useEffect`/foco, `onSave` con validación de `Alert.alert`, tragar error si la tabla no existe todavía). Campos: tipo de diabetes (selector de 4 chips), rango objetivo (dos `TextInput` numéricos), ratio insulina:carb, factor de sensibilidad, año de diagnóstico, zona horaria (offset numérico, con nota explicando que hoy solo aplica a México/CST). Agregar también un mini-formulario "Registrar HbA1c" (valor + fecha, reusar patrón de picker de `AddReadingScreen`) con lista de las últimas 3 mediciones debajo.

### 1.6 Edge Function — leer offset del perfil

En `supabase/functions/sync-health-data/index.ts`:
- Eliminar la constante de módulo `PATIENT_UTC_OFFSET_HOURS = -6` (línea 302).
- En el loop principal que itera `credRows` (líneas 63-68), antes de llamar a `syncUltrahumanForPatient`, hacer `const { data: profile } = await supabaseAdmin.from("patient_profile").select("utc_offset_hours").eq("patient_id", cred.patient_id).maybeSingle();` y usar `profile?.utc_offset_hours ?? -6` como fallback.
- Cambiar la firma de `syncUltrahumanForPatient` (líneas 356-407) para recibir `utcOffsetHours: number` como parámetro y pasarlo a `dateKeyDaysAgo`/`dateKeyToMs` (líneas 304-315) en vez de leer la constante de módulo.
- Redesplegar la función (`supabase functions deploy sync-health-data --no-verify-jwt`, ya usado antes en la sesión).

**Nota de riesgo**: esto cambia comportamiento en producción del cron cada hora. Probar primero con "Sincronizar ahora" manual tras crear el perfil con `utc_offset_hours = -6` (mismo valor que hoy) para confirmar que no cambia nada, antes de considerar ajustar el valor.

### Checklist de verificación — Fase 1
- [ ] `patient_profile` y `hba1c_readings` existen en Supabase con RLS activo (`pg_policies`).
- [ ] `getPatientProfile()` devuelve `null` para un paciente sin fila aún, sin lanzar error.
- [ ] Guardar perfil desde Ajustes y recargar la app — los valores persisten.
- [ ] `HomeScreen` usa `profile.targetRangeLow/High` (o el fallback `DEFAULT_TARGET_RANGE` si no hay perfil) en vez de la constante importada directamente.
- [ ] "Sincronizar ahora" tras crear el perfil con offset `-6` produce los mismos resultados que antes del cambio (sin duplicados, sin desfase).
- [ ] `grep -rn "TARGET_RANGE" src/` solo muestra el fallback documentado, no usos directos sueltos.

---

## Fase 1.5: Restructura de `autoEnrich` para modo gratis (bloqueante de Fase 4)

**Motivo**: `runBackgroundEnrichment()` (`src/lib/autoEnrich.ts:25-58`) tiene un `return` temprano en la línea 28 (`if (!voyageKey) return;`). Todo lo que va después — incluida la detección de patrones (`detectPatterns`, línea 40) — **no corre sin API key del proveedor de embeddings**. Si la Fase 4 mete la persistencia de `pattern_history` y las notificaciones proactivas ahí adentro (como decía el plan original), esas funciones quedan **muertas en modo gratis**. Eso es un retroceso inaceptable dado el requisito de que la app funcione gratis.

**Cambio**: separar en dos funciones con responsabilidades distintas, en `src/lib/autoEnrich.ts`:

```ts
// SIEMPRE corre (gratis, 100% cliente): detección de patrones + (Fase 4) persistencia
// de pattern_history + notificaciones proactivas. No depende de ninguna key de pago.
export async function runPatternAnalysis(): Promise<PatternFinding[]> {
  try {
    const since = Date.now() - ENRICHMENT_WINDOW_MS;
    const [readings, meals, medications, medicationLogs, lifestyleMetrics] = await Promise.all([
      getReadingsSince(since), getMealsSince(since), getActiveMedications(),
      getMedicationLogsSince(since), getLifestyleMetricsSince(since),
    ]);
    const profile = await getPatientProfile().catch(() => null);
    return detectPatterns(readings, meals, medications, medicationLogs, lifestyleMetrics,
      profile?.targetRangeLow ?? TARGET_RANGE.low);
  } catch {
    return [];
  }
}

// Enriquecimiento OPCIONAL con literatura médica: solo si hay key del proveedor configurada.
// Recibe los patrones ya detectados para no recalcularlos.
export async function runBackgroundEnrichment(patterns: PatternFinding[]): Promise<void> {
  try {
    const key = await getEmbeddingApiKey(); // Fase 2: Gemini en vez de Voyage
    if (!key) return;
    for (const pattern of patterns.slice(0, MAX_PATTERNS_TO_ENRICH)) {
      await searchKnowledge(pattern.suggestedQuery, { topK: 3, allowLiveFallback: true });
    }
  } catch { /* oportunista, no interrumpe */ }
}
```

Actualizar los 3 llamadores (`AddReadingScreen.tsx:70`, `MealsScreen.tsx:183`, y donde se dispare tras el sync) para llamar primero `runPatternAnalysis()` y luego, sin `await`, `runBackgroundEnrichment(patterns)`. Ambos siguen siendo fire-and-forget desde la UI.

**Verificación Fase 1.5**:
- [ ] Sin ninguna API key configurada, guardar una lectura sigue disparando `detectPatterns` (verificar con un `console.log` temporal o breakpoint que el motor corre).
- [ ] `npx tsc --noEmit` limpio.
- [ ] `grep -n "if (!voyageKey) return" src/lib/autoEnrich.ts` → sin resultados (ya no bloquea el análisis).

---

## Fase 2: Migración a proveedor gratuito de IA (Google Gemini)

**Decisión del usuario (2026-07-15)**: la app debe funcionar gratis. Se reemplaza Voyage AI (embeddings, de pago) y Anthropic Claude (visión + síntesis, de pago) por Google Gemini, que ofrece tier gratuito sin billing para embeddings y generación (Flash), ambos con visión y salida JSON.

> ✅ **API DE GEMINI VERIFICADA** contra la doc oficial (2026-07-15, cross-check con la referencia REST canónica `https://ai.google.dev/api/generate-content` — se descartaron formas alucinadas por el resumidor de fetch). Hechos confirmados:
>
> **Auth**: header `x-goog-api-key: <KEY>` en todas las llamadas.
>
> **Embeddings** — modelo `gemini-embedding-001` (texto, soporta `task_type`):
> - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
> - Batch: `:batchEmbedContents` con `{"requests": [{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"..."}]}, "taskType":"RETRIEVAL_DOCUMENT", "outputDimensionality":768}, ...]}`
> - Body single: `{"content":{"parts":[{"text":"..."}]}, "taskType":"RETRIEVAL_QUERY", "outputDimensionality":768}`
> - `task_type` válidos: `RETRIEVAL_DOCUMENT` (para "document"), `RETRIEVAL_QUERY` (para "query"), etc.
> - `output_dimensionality`/`outputDimensionality`: flexible 128–3072, recomendados 768/1536/3072. **Fijar 768.**
> - Respuesta single: `{"embedding":{"values":[...]}}`; batch: `{"embeddings":[{"values":[...]}, ...]}`.
>
> **Generación + visión + JSON** — modelo `gemini-2.5-flash` (estable, visión, free tier; `gemini-3.5-flash` es el más nuevo recomendado si se quiere más calidad):
> - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
> - Body: `{"contents":[{"role":"user","parts":[{"text":"..."}, {"inline_data":{"mime_type":"image/jpeg","data":"<base64>"}}]}], "generationConfig":{"responseMimeType":"application/json","responseSchema":{...}}}`
> - `responseSchema` usa JSON Schema estándar (`type`/`properties`/`required`/`enum`/`items`).
> - Respuesta: texto en `candidates[0].content.parts[0].text` (parsear como JSON cuando se pidió `application/json`).
>
> **Free tier**: no requiere billing. Límites RPM/RPD exactos solo visibles en AI Studio (no en la doc pública) — asumir límites conservadores y no paralelizar en exceso.
>
> El implementador DEBE citar la URL de doc en un comentario de cabecera de `gemini.ts`, como exige `AGENTS.md`.

### 2.1 Riesgo técnico central: incompatibilidad de embeddings existentes

Voyage `voyage-3.5` produce vectores de **1024 dimensiones**; Gemini produce otra dimensión (default distinto, configurable). **Los embeddings ya guardados en `knowledge_chunks` son de otro modelo y NO son comparables con queries de Gemini** — mezclarlos daría similitudes basura. Además la comparación coseno solo tiene sentido si TODOS los chunks y la query vienen del mismo modelo.

**Mitigación obligatoria** (para que "nada falle"):
1. Fijar `outputDimensionality` de Gemini a un valor estable y documentarlo como constante (`EMBEDDING_DIMENSIONS`).
2. En la migración, **purgar `knowledge_chunks` y re-ingerir el corpus curado** con Gemini (el corpus está en el bundle, `ingestCorpus` es idempotente por slug — basta con vaciar la tabla primero). Agregar `deleteAllKnowledgeChunks()` a `database.ts` y llamarlo una vez desde la UI de Ajustes con confirmación (`Alert`), o vía un botón "Reconstruir base de conocimiento".
3. Como los chunks de PubMed en vivo (`curated: false`) también quedan obsoletos, se borran en el mismo purgado y se vuelven a generar orgánicamente en el siguiente uso.

Esto NO afecta datos clínicos del paciente (glucosa, comidas, etc.) — `knowledge_chunks` es solo la biblioteca de evidencia, regenerable.

### 2.2 Nuevo módulo `src/lib/gemini.ts`

Reemplaza a `src/lib/voyage.ts`. Lee `src/lib/voyage.ts` completo (69 líneas) para copiar la forma exacta de `getVoyageApiKey`/`setVoyageApiKey`/`clearVoyageApiKey` (SecureStore) y `cosineSimilarity` (esta última se copia intacta, es pura matemática). Provee:
- `getGeminiApiKey`/`setGeminiApiKey`/`clearGeminiApiKey` (nueva storage key `gemini_api_key`).
- `embedTexts(texts, inputType)` con la misma firma pública que hoy exporta `voyage.ts`, para minimizar cambios en `knowledgeBase.ts`. Mapear `inputType` "document"/"query" a los `taskType` de Gemini (`RETRIEVAL_DOCUMENT`/`RETRIEVAL_QUERY` — confirmar nombres exactos en la doc). Batch: confirmar si Gemini soporta `batchEmbedContents` para no hacer N requests.
- `cosineSimilarity` (idéntica).
- Re-exportar un alias `getEmbeddingApiKey = getGeminiApiKey` para que `autoEnrich.ts` (Fase 1.5) no dependa del nombre del proveedor.

### 2.3 Reescribir `src/lib/anthropic.ts` → `src/lib/geminiVision.ts` (o mantener nombre de archivo, cambiar implementación)

Las tres funciones que hoy usan Claude deben usar Gemini Flash, **manteniendo las mismas firmas públicas y los mismos tipos de retorno** para no tocar a sus llamadores (`ImportScreenshotScreen.tsx`, `MealsScreen.tsx`, `HomeScreen.tsx`, `SettingsScreen.tsx`):
- `parseLibreLinkScreenshot(base64)` → visión Gemini, mismo retorno.
- `parseMealPhoto(base64, mime, context, prevAnswers)` → visión Gemini, incluido el flujo de preguntas aclaratorias (mismo shape de retorno).
- `synthesizeEvidence(query, evidence)` → generación Gemini, mismo shape (`etiology`/`management`/`likelyOutcome`/`evidenceStrength`/`caveats`), con las MISMAS instrucciones anti-alucinación que ya tiene el prompt actual (líneas 344-348 del `anthropic.ts` original — cópialas literales, solo cambia el transporte).

Mantener los `throw new Error(...)` en español ya existentes para que el manejo de error de la UI siga funcionando igual.

### 2.4 Actualizar referencias

- `src/lib/knowledgeBase.ts`: cambiar `import { cosineSimilarity, embedTexts } from "./voyage"` → `from "./gemini"`. Nada más cambia (misma firma).
- `src/lib/autoEnrich.ts`: usar `getEmbeddingApiKey` (alias de Gemini) — ya cubierto en Fase 1.5.
- `src/screens/SettingsScreen.tsx`: la sección de API keys debe pedir **una sola key de Gemini** en vez de las de Voyage + Anthropic + (opcional) mantener OCR.space que sigue gratis. Leer la sección actual de keys y reemplazar los dos campos de pago por uno. Agregar el botón "Reconstruir base de conocimiento" (2.1) con su `Alert` de confirmación.
- Borrar `src/lib/voyage.ts` y `src/lib/anthropic.ts` solo tras confirmar que ninguna referencia queda (`grep -rn "from \"../lib/voyage\"\|from \"./voyage\"\|lib/anthropic" src/`).

### 2.5 OCR.space se mantiene

`src/lib/ocrSpace.ts` ya es gratis (tier 25k/mes) — no se toca. Sigue siendo la vía gratuita de captura de pantalla; Gemini Vision pasa a ser la vía "IA" (ahora también gratis). El selector de 3 vías en `ImportScreenshotScreen.tsx` se mantiene igual.

### Verificación Fase 2
- [ ] El implementador leyó las 4 páginas de doc de Gemini y ajustó modelo/endpoint/campos a lo real (citar en comentarios de código la URL de doc usada, como exige `AGENTS.md`).
- [ ] `EMBEDDING_DIMENSIONS` fijado como constante; `knowledge_chunks` purgado y re-ingerido; una búsqueda de conocimiento devuelve resultados con scores plausibles (>0.5 para queries obviamente relacionadas al corpus).
- [ ] `parseMealPhoto` sobre una foto real devuelve macros con el mismo shape que antes; `synthesizeEvidence` devuelve las 5 secciones.
- [ ] `grep -rn "voyage\|anthropic\|VOYAGE\|Anthropic\|claude-sonnet" src/` → sin resultados (proveedor de pago completamente removido).
- [ ] `npx tsc --noEmit` limpio.
- [ ] App funcional end-to-end con SOLO una key gratuita de Gemini configurada (o incluso sin ninguna key: el núcleo de patrones sigue corriendo por Fase 1.5).

---

## Fase 3: Correlación insulina-comida-glucosa

**Depende de Fase 1** (usa `insulin_carb_ratio` del perfil).

### 2.1 Schema — ligar comida a dosis de medicamento

Agregar a `schema.sql` (tabla `meals`, tras línea 65) y a una migración `supabase/migration_meal_medication_link.sql`:
```sql
alter table meals add column if not exists linked_medication_log_id bigint references medication_logs (id) on delete set null;
```

### 2.2 Tipos (`src/types/index.ts`)

En la interfaz `Meal`/`NewMeal` (líneas 121-149), agregar `linkedMedicationLogId: number | null`.

### 2.3 `src/db/database.ts`

- Extender `mapMealRow` (líneas 292-308) con `linkedMedicationLogId: row.linked_medication_log_id`.
- Extender `insertMeal` (líneas 310-329) con `linked_medication_log_id: meal.linkedMedicationLogId` en el objeto insertado.
- No existe `updateMeal` — no es necesario para este alcance (el vínculo se fija al crear la comida).
- Agregar filtro por tipo bolus a `getActiveMedications`/`getMedicationLogsSince` (líneas 216-223, 258-274) solo del lado del componente (filtrar client-side por `medicationId` cuyo `medications.type === "insulin_bolus"`), ya que no hay precedente de un query server-side por tipo — mantener consistencia con el estilo actual del archivo (queries simples, filtros compuestos en el cliente).

### 2.4 `MealsScreen.tsx` — hora retroactiva + selector de dosis

- Copiar el bloque de estado y JSX de `AddReadingScreen.tsx:32-43, 90-121` (picker de fecha/hora, validación anti-futuro) e insertarlo antes de "Descripción" (línea 282).
- Reemplazar `timestampMs: Date.now()` (línea 168) por `timestampMs: dateTime.getTime()`.
- Agregar `const [linkedMedicationLogId, setLinkedMedicationLogId] = useState<number | null>(null)`, cargar `getMedicationLogsSince(Date.now() - 6*3600*1000)` (últimas 6h, ventana razonable para "dosis reciente relacionada con esta comida") filtrado por tipo bolus, y un selector simple (lista de chips con hora+dosis, opción "Ninguna/No aplicó bolo").
- Extender `resetForm` (líneas 60-71) para resetear `dateTime` y `linkedMedicationLogId`.
- Pasar `linkedMedicationLogId` en el objeto de `insertMeal` (línea 167-168 en adelante).

### 2.5 Mejorar `detectPostMealHyperglycemia` (`src/lib/patterns.ts:108-143`)

Cambiar la firma para recibir también `medicationLogs: MedicationLog[]` y `profile: { insulinCarbRatio: number | null }`, y para cada comida ≥60g carbs en la ventana:
- Si `meal.linkedMedicationLogId` es `null` → clasificar como "comida sin bolo registrado".
- Si tiene bolo vinculado y `profile.insulinCarbRatio` existe → calcular dosis esperada (`carbsG / insulinCarbRatio`) y comparar contra `medicationLogs.find(l => l.id === meal.linkedMedicationLogId)?.doseAmount`; si la dosis real es significativamente menor (ej. <70% de la esperada) → clasificar como "bolo probablemente insuficiente".
- Reportar como dos `PatternFinding` separados (o un solo finding con desglose en la descripción) en vez de la actual generalización única "≥50% de comidas exceden 180 mg/dL" — esto es lo que da la distinción causal pedida (dosis insuficiente vs. carbohidratos sin cubrir vs. otra causa).
- Actualizar el llamador en `detectPatterns()` (línea 305) para pasar los nuevos parámetros — `detectPatterns()` ya recibe `medications`/`medicationLogs`, solo falta agregar `profile`.

### Checklist de verificación — Fase 2
- [ ] Guardar una comida con hora de hace 2 horas — se guarda con ese `timestampMs`, no con la hora actual.
- [ ] Ligar una comida a una dosis de insulina bolus reciente — `linked_medication_log_id` se persiste correctamente (verificar con una query directa en Supabase).
- [ ] Guardar una comida sin ligar a ninguna dosis — `linked_medication_log_id` es `null`, no rompe el insert.
- [ ] `detectPostMealHyperglycemia` distingue en su output "sin bolo" vs "bolo insuficiente" cuando el perfil tiene `insulinCarbRatio` configurado.
- [ ] Sin perfil o sin `insulinCarbRatio`, el detector sigue funcionando en modo degradado (comportamiento actual, sin lanzar error).

---

## Fase 4: Motor de patrones con memoria/tendencia + reporte proactivo

**Depende de Fase 1** (perfil para umbrales personalizados) y **Fase 1.5** (restructura de `autoEnrich` para que la memoria de patrones corra gratis). Beneficia de Fase 3 (mejor causalidad post-comida), pero puede implementarse independientemente si se prioriza.

### 3.1 Schema — historial de patrones

Agregar a `schema.sql` y a `supabase/migration_pattern_history.sql`:
```sql
-- Historial de patrones detectados, calculado client-side (por eso default auth.uid(),
-- a diferencia de sync_runs que es solo service_role). Permite tendencia semana a semana
-- y evita re-notificar el mismo hallazgo repetidamente.
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
```

### 3.2 Cruzar `detectDawnPhenomenon` con `detectNocturnalHypoglycemia` (descartar Somogyi)

En `src/lib/patterns.ts`:
- Extraer de `detectNocturnalHypoglycemia` (líneas 85-106) el `Set<string>` de noches con hipoglucemia **antes** del `return`, exportándolo vía un helper separado: `function findHypoNights(readings: GlucoseReading[], targetLow: number): Set<string>` (nuevo, factoriza líneas 86-94).
- Cambiar `detectDawnPhenomenon` (línea 61) de `for (const { bedtime, dawn } of byDay.values())` a `for (const [key, { bedtime, dawn }] of byDay.entries())`, y agregar el parámetro `hypoNights: Set<string>`, filtrando `if (hypoNights.has(key)) continue;` — esas noches se excluyen del cálculo de "subida de alba" porque la subida probablemente es rebote (Somogyi), no fenómeno del alba real.
- En `detectPatterns()` (líneas 301-305), calcular `const hypoNights = findHypoNights(readings, targetLow);` una vez y pasarlo tanto a `detectNocturnalHypoglycemia` (refactorizada para recibir el set ya calculado, o recalcularlo internamente sin duplicar lógica) como a `detectDawnPhenomenon`.
- Si `hypoNights.has(key)` causa que **todas** las noches con subida de alba se excluyan, no reportar fenómeno del alba en absoluto ese ciclo — comportamiento correcto y ya cubierto por el `if (qualifyingDays < MIN_DAYS_FOR_DAWN_PATTERN) return null;` existente (línea 72), sin cambios adicionales necesarios ahí.

### 3.3 Persistir y calcular tendencia

> **Ubicación (post Fase 1.5)**: esto va DENTRO de `runPatternAnalysis()` (la función que SIEMPRE corre gratis), no de `runBackgroundEnrichment()`. La persistencia de historial y las notificaciones NO deben depender de la key de Gemini.

En `runPatternAnalysis()` (tras `detectPatterns()`, antes de devolver los patrones):
```ts
const { data: previousRuns } = await supabase
  .from("pattern_history")
  .select("pattern_id, severity, evidence_count, detected_at_ms")
  .gte("detected_at_ms", Date.now() - 28 * 24 * 60 * 60 * 1000)
  .order("detected_at_ms", { ascending: false });

for (const pattern of patterns) {
  const previous = previousRuns?.find((p) => p.pattern_id === pattern.id);
  await supabase.from("pattern_history").insert({
    pattern_id: pattern.id,
    severity: pattern.severity,
    evidence_count: pattern.evidenceCount,
    window_start_ms: since,
    window_end_ms: Date.now(),
  });
  // trend: comparar pattern.evidenceCount contra previous?.evidence_count
}
```
Extender `PatternFinding` (`types/index.ts:228-235`) con un campo opcional `trend?: "worsening" | "improving" | "stable" | "new"` calculado por comparación simple de `evidenceCount` contra el registro anterior más reciente del mismo `pattern_id` (mismo enfoque de comparación de medias ya usado en el resto del archivo — no se pide aquí estadística inferencial nueva, solo persistencia + delta).

Mantener el mismo bloque `try/catch` silencioso ya existente en `autoEnrich.ts` (líneas 26-56) envolviendo también estas nuevas llamadas — no debe romper el guardado del usuario si `pattern_history` aún no existe (tabla no migrada) o falla el insert.

### 3.4 Notificación proactiva

Antes de escribir código: **leer la documentación versionada de Expo SDK v57** sobre triggers de `expo-notifications` (`https://docs.expo.dev/versions/v57.0.0/sdk/notifications/`) para confirmar la forma correcta de disparar una notificación local inmediata (probablemente `trigger: null` o `{ seconds: 1 }` según la versión — no asumir sin verificar, por instrucción explícita de `AGENTS.md`).

En `src/lib/notifications.ts`, agregar (siguiendo el patrón de `scheduleMedicationReminders`, líneas 20-48, pero con trigger inmediato en vez de `CALENDAR`):
```ts
export async function notifyPatternFinding(title: string, body: string): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: /* confirmar valor exacto contra doc v57 */,
  });
}
```

En `runPatternAnalysis()` (Fase 1.5), tras persistir en `pattern_history`: si `pattern.severity === "attention"` y `!notified` (no se ha notificado ya esta semana para el mismo `pattern_id` — chequear contra `previousRuns` con `notified: true` en los últimos 7 días), llamar `notifyPatternFinding(pattern.title, pattern.description)` y marcar el registro insertado con `notified: true`.

### 3.5 UI — mostrar tendencia en `HomeScreen.tsx`

En `PatternCard` (líneas 354-447), si `pattern.trend` existe, mostrar un badge pequeño ("↑ empeorando" / "↓ mejorando" / "= estable" / "nuevo") junto al título.

### Checklist de verificación — Fase 3
- [ ] `pattern_history` existe con RLS `for all` (client-side insert funciona con sesión de usuario normal, no requiere `service_role`).
- [ ] Con datos sintéticos de hipoglucemia nocturna + subida matutina en la misma noche, `detectDawnPhenomenon` NO reporta fenómeno del alba para esa noche (se excluye por Somogyi).
- [ ] Con datos sintéticos de subida matutina SIN hipoglucemia previa, `detectDawnPhenomenon` sí reporta normalmente (no se rompió el caso positivo original).
- [ ] Ejecutar `autoEnrich` dos veces con una semana de diferencia (simulado) — el segundo `PatternFinding` trae `trend` calculado contra el primero.
- [ ] Notificación local se dispara solo para severidad `attention` y solo una vez por semana por patrón (no spam en cada guardado).
- [ ] Confirmar contra la doc v57 real que el `trigger` usado es válido antes de mergear (no inventado).

---

## Fase final: Verificación end-to-end

1. `grep -rn "TARGET_RANGE\b" src/` → solo aparece el fallback documentado, ningún uso directo nuevo.
2. `grep -rn "PATIENT_UTC_OFFSET_HOURS" supabase/` → sin resultados (constante eliminada del Edge Function).
3. Correr la app en Expo Go (túnel), flujo completo: crear perfil → registrar HbA1c → registrar comida con hora retroactiva y bolo ligado → ver patrón post-comida con causa distinguida → ver patrón de fenómeno del alba correctamente filtrado si hubo hipo nocturna → recibir notificación proactiva si aplica.
4. Revisar `sync_runs` tras una corrida del cron para confirmar que el cambio de offset por perfil no rompió el sync automático existente.
5. Revisar en Supabase que las 4 tablas nuevas (`patient_profile`, `hba1c_readings`, `pattern_history`, más la columna en `meals`) tienen RLS activo y las políticas correctas (`select * from pg_policies where tablename like 'patient_%' or tablename = 'hba1c_readings' or tablename = 'pattern_history';`).
6. **Modo gratis**: correr la app con CERO API keys configuradas y confirmar que el núcleo funciona — sync, entrada manual, OCR.space, motor de patrones, memoria/tendencia y notificaciones proactivas. Solo el enriquecimiento con literatura debe quedar inactivo (degradación limpia, sin errores).
7. **Proveedor de pago removido**: `grep -rn "voyage\|Voyage\|anthropic\|Anthropic\|claude-sonnet" src/` → sin resultados. Confirmar que la única key de IA que pide Ajustes es la de Gemini (gratuita).

---

## Backlog (gaps secundarios de la auditoría, fuera de alcance de este plan)

- `lifestyle_metrics.raw` sin parsear (señal intradiaria de Ultrahuman atrapada sin usar).
- `knowledge_chunks` compartida sin scoping por paciente, embeddings en `jsonb` comparados linealmente (no escala) — considerar `pgvector` si crece a multi-paciente real.
- Credenciales de `sync_credentials` sin cifrado end-to-end (documentado como trade-off aceptado).
- API keys de terceros (Gemini, OCR.space) viven en el cliente sin proxy de servidor — costo cero mientras se use el tier gratis, pero sin control central de cuota/rotación.
- Límites de tasa del tier gratis de Gemini (RPM/RPD): si la app escala a varios pacientes, el enriquecimiento podría toparse con el límite — monitorear y considerar backoff/cola si aparece.
