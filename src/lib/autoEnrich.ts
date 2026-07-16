import {
  getActiveMedications,
  getLifestyleMetricsSince,
  getMealsSince,
  getMedicationLogsSince,
  getReadingsSince,
  getPatientProfile,
} from "../db/database";
import { detectPatterns } from "./patterns";
import { searchKnowledge } from "./knowledgeBase";
import { getEmbeddingApiKey } from "./gemini";
import { supabase } from "./supabase";
import { notifyPatternFinding } from "./notifications";
import { TARGET_RANGE } from "../types";
import type { PatternFinding } from "../types";

const ENRICHMENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PATTERNS_TO_ENRICH = 3;
// Ventana de lectura del historial para calcular tendencia (4 semanas).
const PATTERN_HISTORY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
// No re-notificar el mismo patrón más de una vez por semana.
const NOTIFY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface PatternHistoryRow {
  pattern_id: string;
  severity: string;
  evidence_count: number;
  detected_at_ms: number;
  notified: boolean;
}

// Análisis de patrones — SIEMPRE corre, gratis y 100% del lado del cliente.
// No depende de ninguna API key de pago. Devuelve los patrones detectados para
// que quien llame decida qué hacer con ellos (enriquecerlos, mostrarlos y, en
// fases posteriores, persistir historial de tendencia / disparar notificaciones
// proactivas). Nunca lanza — un fallo acá no debe interrumpir el guardado.
export async function runPatternAnalysis(): Promise<PatternFinding[]> {
  try {
    const since = Date.now() - ENRICHMENT_WINDOW_MS;
    const [readings, meals, medications, medicationLogs, lifestyleMetrics] =
      await Promise.all([
        getReadingsSince(since),
        getMealsSince(since),
        getActiveMedications(),
        getMedicationLogsSince(since),
        getLifestyleMetricsSince(since),
      ]);

    // El perfil personaliza el umbral bajo; si la tabla aún no existe (migración
    // no corrida) o el paciente no lo configuró, caemos al rango por defecto.
    const profile = await getPatientProfile().catch(() => null);
    const targetLow = profile?.targetRangeLow ?? TARGET_RANGE.low;

    const patterns = detectPatterns(
      readings,
      meals,
      medications,
      medicationLogs,
      lifestyleMetrics,
      targetLow,
      profile?.insulinCarbRatio ?? null
    );

    // Historial de patrones + tendencia + notificación proactiva (Fase 4).
    // Todo dentro de su propio try/catch: si pattern_history no existe (migración
    // no corrida) o falla el insert/lectura, degradamos devolviendo los patrones
    // SIN trend, sin notificar, sin romper el análisis ni el guardado del usuario.
    try {
      const now = Date.now();
      const { data } = await supabase
        .from("pattern_history")
        .select("pattern_id, severity, evidence_count, detected_at_ms, notified")
        .gte("detected_at_ms", now - PATTERN_HISTORY_WINDOW_MS)
        .order("detected_at_ms", { ascending: false });
      const previousRuns = (data ?? []) as PatternHistoryRow[];

      const rows: Array<{
        pattern_id: string;
        severity: string;
        evidence_count: number;
        window_start_ms: number;
        window_end_ms: number;
        notified: boolean;
      }> = [];

      for (const pattern of patterns) {
        // Registro previo más reciente del mismo patrón (previousRuns ya viene
        // ordenado por detected_at_ms desc, así que el primer match es el último).
        const previous = previousRuns.find((p) => p.pattern_id === pattern.id);

        // Tendencia por comparación simple de evidenceCount.
        if (!previous) {
          pattern.trend = "new";
        } else if (pattern.evidenceCount < previous.evidence_count) {
          pattern.trend = "improving";
        } else if (pattern.evidenceCount > previous.evidence_count) {
          pattern.trend = "worsening";
        } else {
          pattern.trend = "stable";
        }

        // Notificación proactiva: solo severidad "attention" y máximo una vez por
        // semana por patrón. Se decide `notified` ANTES del insert para poder
        // persistir el estado en el mismo registro.
        let notified = false;
        if (pattern.severity === "attention") {
          const notifiedRecently = previousRuns.some(
            (p) =>
              p.pattern_id === pattern.id &&
              p.notified === true &&
              p.detected_at_ms > now - NOTIFY_COOLDOWN_MS
          );
          if (!notifiedRecently) {
            await notifyPatternFinding(pattern.title, pattern.description);
            notified = true;
          }
        }

        rows.push({
          pattern_id: pattern.id,
          severity: pattern.severity,
          evidence_count: pattern.evidenceCount,
          window_start_ms: since,
          window_end_ms: now,
          notified,
        });
      }

      if (rows.length > 0) {
        await supabase.from("pattern_history").insert(rows);
      }
    } catch {
      // Historial no disponible (tabla no migrada) o error de red/insert:
      // degradamos limpio. Los patrones ya están calculados y se devuelven igual.
    }

    return patterns;
  } catch {
    return [];
  }
}

// Enriquecimiento OPCIONAL con literatura médica: solo si hay API key de
// embeddings configurada. Recibe los patrones ya detectados para no
// recalcularlos. searchKnowledge inserta lo que encuentra en knowledge_chunks
// (marcado "no revisado" si viene de PubMed en vivo), así la biblioteca crece
// con cada uso real. Sin key no hace nada: sin embeddings no hay forma de buscar
// ni insertar resultados con sentido. Nunca lanza.
export async function runBackgroundEnrichment(
  patterns: PatternFinding[]
): Promise<void> {
  try {
    const key = await getEmbeddingApiKey();
    if (!key) return;

    for (const pattern of patterns.slice(0, MAX_PATTERNS_TO_ENRICH)) {
      await searchKnowledge(pattern.suggestedQuery, {
        topK: 3,
        allowLiveFallback: true,
      });
    }
  } catch {
    // Enriquecimiento oportunista: sin conexión, PubMed caído, etc. no deben
    // afectar el flujo principal de la app.
  }
}

// Orquestador fire-and-forget que usan las pantallas después de guardar datos
// (lectura, comida, toma de medicamento, sincronización). Corre el análisis de
// patrones (gratis, siempre) y luego intenta el enriquecimiento (opcional). Un
// fallo en cualquiera de los dos no interrumpe el guardado del usuario.
export async function runBackgroundTasks(): Promise<void> {
  const patterns = await runPatternAnalysis();
  await runBackgroundEnrichment(patterns);
}
