import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getActiveMedications,
  getLifestyleMetricsSince,
  getMealsSince,
  getMedicationLogsSince,
  getPatientProfile,
  getReadingsSince,
} from "../db/database";
import { detectPatterns } from "../lib/patterns";
import { usePatternEvidence } from "../hooks/usePatternEvidence";
import { EvidencePaperCard } from "../components/EvidencePaperCard";
import {
  EvidenceSynthesisBox,
  SynthesizeButton,
} from "../components/EvidenceSynthesisBox";
import { ThemedTextInput } from "../components/ThemedTextInput";
import type { ActivationResult } from "../lib/knowledgeGraph";
import type { PatternFinding } from "../types";
import { TARGET_RANGE } from "../types";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, borderRadius, MIN_TOUCH_TARGET, type Palette } from "../theme";

const DAY_MS = 24 * 60 * 60 * 1000;
const PATTERN_WINDOW_MS = 14 * DAY_MS;

/** Cuántos papers pedirle al grafo. Más que en Inicio: aquí es la pantalla principal. */
const TOP_K = 8;

type StrengthFilter = "all" | ActivationResult["confidence"];

const STRENGTH_FILTER_LABELS: Record<StrengthFilter, string> = {
  all: "Todas",
  strong: "Sólida",
  moderate: "Moderada",
  limited: "Limitada",
};

export default function EvidenceScreen() {
  const styles = useThemedStyles(createStyles);
  const [patterns, setPatterns] = useState<PatternFinding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [strength, setStrength] = useState<StrengthFilter>("all");
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const selected = patterns.find((p) => p.id === selectedId) ?? null;
  const {
    searching,
    evidence,
    synthesizing,
    synthesis,
    feedbackStates,
    loadEvidence,
    synthesize,
    sendFeedback,
  } = usePatternEvidence(selected, TOP_K);

  const load = useCallback(async () => {
    const since = Date.now() - PATTERN_WINDOW_MS;
    const [rows, meals, medications, medicationLogs, lifestyle, profile] =
      await Promise.all([
        getReadingsSince(since),
        getMealsSince(since),
        getActiveMedications(),
        getMedicationLogsSince(since),
        getLifestyleMetricsSince(since),
        // Misma degradación que en Inicio: sin patient_profile se usa el
        // rango objetivo por defecto en vez de romper la pantalla.
        getPatientProfile().catch(() => null),
      ]);

    const found = detectPatterns(
      rows,
      meals,
      medications,
      medicationLogs,
      lifestyle,
      profile?.targetRangeLow ?? TARGET_RANGE.low
    );
    setPatterns(found);
    setSelectedId((current) =>
      current && found.some((p) => p.id === current) ? current : found[0]?.id ?? null
    );
    setLoadingPatterns(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // La búsqueda en el grafo se dispara sola: esta pantalla existe para ver la
  // evidencia, así que no tiene sentido pedir un toque extra para empezar.
  useFocusEffect(
    useCallback(() => {
      if (selected) loadEvidence();
    }, [selected, loadEvidence])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = filterEvidence(evidence ?? [], query, strength);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.description}>
        Investigación científica relacionada con los patrones detectados en tus datos.
      </Text>

      {loadingPatterns ? (
        <ActivityIndicator style={styles.loader} />
      ) : patterns.length === 0 ? (
        <Text style={styles.emptyText}>
          Todavía no hay patrones detectados con suficientes datos. Entre más
          registres, más evidencia relacionada podrá encontrarse.
        </Text>
      ) : (
        <>
          <PatternSelector
            patterns={patterns}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setExpandedPaperId(null);
            }}
          />

          {selected && (
            <View style={styles.connectionCard}>
              <Text style={styles.connectionTitle}>Relacionado con tus patrones</Text>
              <Text style={styles.connectionText}>{selected.description}</Text>
            </View>
          )}

          <ThemedTextInput
            style={styles.search}
            placeholder="Buscar por título o autor..."
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar artículos por título o autor"
          />

          <StrengthFilterRow value={strength} onChange={setStrength} />

          {searching && <ActivityIndicator style={styles.loader} />}

          {!searching && evidence !== null && (
            <>
              {visible.length === 0 ? (
                <Text style={styles.emptyText}>
                  {evidence.length === 0
                    ? "No se encontraron artículos para este patrón."
                    : "Ningún artículo coincide con tu búsqueda."}
                </Text>
              ) : (
                visible.map((result) => (
                  <EvidencePaperCard
                    key={result.paperId}
                    result={result}
                    expanded={expandedPaperId === result.paperId}
                    onToggle={() =>
                      setExpandedPaperId((current) =>
                        current === result.paperId ? null : result.paperId
                      )
                    }
                    feedback={feedbackStates[result.paperId]}
                    onFeedback={(wasHelpful) => sendFeedback(result.paperId, wasHelpful)}
                  />
                ))
              )}

              {evidence.length > 0 && !synthesis && (
                <SynthesizeButton synthesizing={synthesizing} onPress={synthesize} />
              )}
              {synthesis && <EvidenceSynthesisBox synthesis={synthesis} />}
            </>
          )}
        </>
      )}

      <Text style={styles.disclaimer}>
        La evidencia científica es contexto general, no una indicación para tu caso.
        Habla estos temas con tu equipo de endocrinología.
      </Text>
    </ScrollView>
  );
}

/** Filtra por texto libre (título o autor) y por fuerza de la evidencia. */
export function filterEvidence(
  results: ActivationResult[],
  query: string,
  strength: StrengthFilter
): ActivationResult[] {
  const needle = query.trim().toLowerCase();
  return results.filter((r) => {
    const matchesQuery =
      needle.length === 0 ||
      r.paper.title.toLowerCase().includes(needle) ||
      r.paper.authors.toLowerCase().includes(needle);
    const matchesStrength = strength === "all" || r.confidence === strength;
    return matchesQuery && matchesStrength;
  });
}

const SEVERITY_DOTS: Record<PatternFinding["severity"], string> = {
  attention: "🔴",
  watch: "🟡",
  info: "🔵",
};

export function PatternSelector({
  patterns,
  selectedId,
  onSelect,
}: {
  patterns: PatternFinding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {patterns.map((pattern) => {
        const active = pattern.id === selectedId;
        return (
          <Pressable
            key={pattern.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(pattern.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={`pattern-chip-${pattern.id}${active ? "-active" : ""}`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {SEVERITY_DOTS[pattern.severity]} {pattern.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function StrengthFilterRow({
  value,
  onChange,
}: {
  value: StrengthFilter;
  onChange: (next: StrengthFilter) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.filterRow}>
      {(["all", "strong", "moderate", "limited"] as const).map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.filterButton, active && styles.filterButtonActive]}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={`strength-${option}${active ? "-active" : ""}`}
          >
            <Text style={[styles.filterText, active && styles.filterTextActive]}>
              {STRENGTH_FILTER_LABELS[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    description: { fontSize: 13, color: c.textSecondary, marginBottom: spacing.md, lineHeight: 19 },
    loader: { marginVertical: spacing.md },

    chipRow: { gap: spacing.sm, paddingBottom: spacing.sm, paddingRight: spacing.md },
    chip: {
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      maxWidth: 260,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.textBody },
    chipTextActive: { color: c.textOnAccent },

    connectionCard: {
      backgroundColor: c.accentLight,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    connectionTitle: { fontSize: 12, fontWeight: "700", color: c.text, marginBottom: 4 },
    connectionText: { fontSize: 12, color: c.textBody, lineHeight: 18 },

    search: {
      fontSize: 14,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      minHeight: MIN_TOUCH_TARGET,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.sm,
    },

    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    filterButton: {
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterButtonActive: { backgroundColor: c.accent, borderColor: c.accent },
    filterText: { fontSize: 12, color: c.textBody },
    filterTextActive: { color: c.textOnAccent, fontWeight: "600" },

    emptyText: {
      color: c.textSecondary,
      textAlign: "center",
      marginVertical: spacing.lg,
      lineHeight: 20,
    },
    disclaimer: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: "center",
      marginTop: spacing.md,
      fontStyle: "italic",
    },
  });
