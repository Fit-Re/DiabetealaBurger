import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  getPatientPaperFeedback,
  initializeKnowledgeGraph,
  recordPatternFeedback,
  searchViaGraphPersonalized,
} from "../lib/knowledgeBase";
import { synthesizeEvidence } from "../lib/geminiVision";
import type { EvidenceSynthesis } from "../lib/geminiVision";
import type { ActivationResult } from "../lib/knowledgeGraph";
import type { PatternFinding } from "../types";
import { useAuth } from "../lib/auth";

/** Severidad del patrón traducida al peso que espera la propagación del grafo. */
function severityWeight(severity: PatternFinding["severity"]): number {
  return severity === "attention" ? 1.0 : severity === "watch" ? 0.6 : 0.3;
}

export interface PatternEvidence {
  searching: boolean;
  evidence: ActivationResult[] | null;
  synthesizing: boolean;
  synthesis: EvidenceSynthesis | null;
  /** paperId -> si el paciente lo marcó como útil. */
  feedbackStates: Record<string, boolean | null>;
  /** Busca la evidencia del patrón. No repite el trabajo si ya está cargada. */
  loadEvidence: () => Promise<void>;
  synthesize: () => Promise<void>;
  sendFeedback: (paperId: string, wasHelpful: boolean) => Promise<void>;
}

/**
 * Búsqueda de evidencia para un patrón: inicializa el grafo de conocimiento,
 * busca papers personalizados por preferencias e historial de feedback, y
 * sintetiza el resumen clínico.
 *
 * Vive aquí y no dentro de una pantalla porque lo consumen dos: la tarjeta de
 * patrón de Inicio y la pantalla de Evidencia.
 *
 * @param pattern Patrón activo, o null si todavía no hay ninguno seleccionado.
 * @param topK Cuántos papers pedir al grafo.
 */
export function usePatternEvidence(
  pattern: PatternFinding | null,
  topK: number = 4
): PatternEvidence {
  const { session } = useAuth();
  const [searching, setSearching] = useState(false);
  const [evidence, setEvidence] = useState<ActivationResult[] | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<EvidenceSynthesis | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<string, boolean | null>>({});

  const patternId = pattern?.id ?? null;

  // Al cambiar de patrón, lo cargado deja de aplicar: se descarta para no
  // mostrar los papers de un patrón bajo el título de otro.
  useEffect(() => {
    setEvidence(null);
    setSynthesis(null);
    setFeedbackStates({});
  }, [patternId]);

  const loadEvidence = useCallback(async () => {
    if (!pattern || evidence !== null || searching) return;
    setSearching(true);
    try {
      await initializeKnowledgeGraph();

      const patientId = session?.user?.id ?? "unknown";
      const found = await searchViaGraphPersonalized(
        pattern.suggestedQuery,
        patientId,
        1,
        severityWeight(pattern.severity),
        topK,
        pattern.id
      );
      setEvidence(found);

      // Feedback previo del paciente sobre estos mismos papers.
      const feedback: Record<string, boolean | null> = {};
      for (const result of found) {
        const existing = await getPatientPaperFeedback(patientId, result.paperId);
        if (existing) {
          feedback[result.paperId] = existing.wasHelpful;
        }
      }
      setFeedbackStates(feedback);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo buscar evidencia relacionada.");
    } finally {
      setSearching(false);
    }
  }, [pattern, evidence, searching, session, topK]);

  const sendFeedback = useCallback(
    async (paperId: string, wasHelpful: boolean) => {
      if (!pattern) return;
      const patientId = session?.user?.id ?? "unknown";
      try {
        await recordPatternFeedback(patientId, pattern.id, paperId, wasHelpful);
        setFeedbackStates((prev) => ({ ...prev, [paperId]: wasHelpful }));
        Alert.alert(
          "Gracias",
          wasHelpful
            ? "Nos alegra que te haya sido útil 😊"
            : "Entendido, usaremos esto para mejorar"
        );
      } catch (e: any) {
        Alert.alert("Error", "No se pudo registrar tu opinión.");
      }
    },
    [pattern, session]
  );

  const synthesize = useCallback(async () => {
    if (!pattern || !evidence || evidence.length === 0) return;
    setSynthesizing(true);
    try {
      const result = await synthesizeEvidence(pattern.suggestedQuery, evidence);
      setSynthesis(result);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo generar el resumen clínico.");
    } finally {
      setSynthesizing(false);
    }
  }, [pattern, evidence]);

  return {
    searching,
    evidence,
    synthesizing,
    synthesis,
    feedbackStates,
    loadEvidence,
    synthesize,
    sendFeedback,
  };
}
