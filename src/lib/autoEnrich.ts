import {
  getActiveMedications,
  getLifestyleMetricsSince,
  getMealsSince,
  getMedicationLogsSince,
  getReadingsSince,
} from "../db/database";
import { detectPatterns } from "./patterns";
import { searchKnowledge } from "./knowledgeBase";
import { getVoyageApiKey } from "./voyage";

const ENRICHMENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PATTERNS_TO_ENRICH = 3;

// Se llama en segundo plano (sin await) después de guardar datos nuevos:
// lectura de glucosa, comida, toma de medicamento, o sincronización de
// LibreLinkUp/Ultrahuman. Corre el motor de patrones sobre los datos
// recientes y, para los patrones detectados, dispara una búsqueda de
// evidencia con fallback en vivo a PubMed — searchKnowledge ya inserta lo
// que encuentra en knowledge_chunks marcado como no curado (visible como
// "no revisado" en la UI), así la biblioteca crece con cada uso real de la
// app. Si no hay API key de Voyage configurada no hace nada: sin
// embeddings no hay forma de buscar ni insertar resultados con sentido.
// Nunca lanza — un fallo acá no debe interrumpir el guardado del usuario.
export async function runBackgroundEnrichment(): Promise<void> {
  try {
    const voyageKey = await getVoyageApiKey();
    if (!voyageKey) return;

    const since = Date.now() - ENRICHMENT_WINDOW_MS;
    const [readings, meals, medications, medicationLogs, lifestyleMetrics] =
      await Promise.all([
        getReadingsSince(since),
        getMealsSince(since),
        getActiveMedications(),
        getMedicationLogsSince(since),
        getLifestyleMetricsSince(since),
      ]);

    const patterns = detectPatterns(
      readings,
      meals,
      medications,
      medicationLogs,
      lifestyleMetrics
    );

    for (const pattern of patterns.slice(0, MAX_PATTERNS_TO_ENRICH)) {
      await searchKnowledge(pattern.suggestedQuery, {
        topK: 3,
        allowLiveFallback: true,
      });
    }
  } catch {
    // Enriquecimiento oportunista: sin conexión, PubMed caído, etc. no
    // deben afectar el flujo principal de la app.
  }
}
