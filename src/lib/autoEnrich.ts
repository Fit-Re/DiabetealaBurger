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
import { getVoyageApiKey } from "./voyage";
import { TARGET_RANGE } from "../types";
import type { PatternFinding } from "../types";

const ENRICHMENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PATTERNS_TO_ENRICH = 3;

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

    return detectPatterns(
      readings,
      meals,
      medications,
      medicationLogs,
      lifestyleMetrics,
      targetLow
    );
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
    const key = await getVoyageApiKey();
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
