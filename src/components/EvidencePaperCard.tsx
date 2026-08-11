import React from "react";
import { View, Text, StyleSheet, Pressable, Linking, Alert } from "react-native";
import type { ActivationResult } from "../lib/knowledgeGraph";
import { EvidenceFeedbackButtons } from "./EvidenceFeedbackButtons";
import { EVIDENCE_STRENGTH_LABELS } from "./EvidenceSynthesisBox";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, borderRadius, MIN_TOUCH_TARGET, type Palette } from "../theme";

/**
 * Tarjeta de un paper activado por el grafo de conocimiento.
 *
 * Muestra solo datos reales: la relevancia es el `activationScore` del grafo y
 * la fuerza es su `confidence`. El prototipo enseñaba además un contador de
 * citas, pero eso venía de datos falsos y no existe en el corpus, así que en su
 * lugar se muestra la ruta de activación, que sí es real y explica el porqué.
 */
export function EvidencePaperCard({
  result,
  expanded,
  onToggle,
  feedback,
  onFeedback,
}: {
  result: ActivationResult;
  expanded: boolean;
  onToggle: () => void;
  feedback: boolean | null | undefined;
  onFeedback: (wasHelpful: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { paper } = result;

  const strengthStyle = {
    strong: styles.badgeStrong,
    moderate: styles.badgeModerate,
    limited: styles.badgeLimited,
  }[result.confidence];

  const openPaper = async () => {
    if (!paper.url) return;
    try {
      await Linking.openURL(paper.url);
    } catch {
      Alert.alert("Error", "No se pudo abrir el artículo.");
    }
  };

  return (
    <View style={styles.card} testID={`paper-${result.paperId}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.title}>{paper.title}</Text>
        <Text style={styles.authors}>{paper.authors}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {paper.year || "s/f"} · {paper.source}
          </Text>
          <View style={[styles.badge, strengthStyle]}>
            <Text style={styles.badgeText}>
              Evidencia {EVIDENCE_STRENGTH_LABELS[result.confidence]}
            </Text>
          </View>
        </View>

        {!paper.curated && (
          <Text style={styles.uncurated}>🔴 No revisado (PubMed en vivo)</Text>
        )}

        <View style={styles.relevanceTrack}>
          <View
            testID={`relevance-${result.paperId}`}
            style={[
              styles.relevanceFill,
              { width: `${Math.round(result.activationScore * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.meta}>
          Relevancia {(result.activationScore * 100).toFixed(0)}% ·{" "}
          {result.hopCount === 0
            ? "coincidencia directa"
            : `${result.hopCount} salto${result.hopCount > 1 ? "s" : ""} en el grafo`}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.expanded}>
          <Text style={styles.summary}>{paper.summary}</Text>
          <Text style={styles.path}>Ruta: {result.path.join(" → ")}</Text>

          {paper.url && (
            <Pressable
              style={styles.readMore}
              onPress={openPaper}
              accessibilityRole="link"
            >
              <Text style={styles.readMoreText}>Leer artículo completo</Text>
            </Pressable>
          )}

          <EvidenceFeedbackButtons value={feedback} onPress={onFeedback} />
        </View>
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 14,
      marginBottom: spacing.sm,
    },
    title: { fontSize: 14, fontWeight: "700", color: c.text, lineHeight: 20 },
    authors: { fontSize: 12, color: c.textSecondary, marginTop: 4 },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    meta: { fontSize: 11, color: c.textSecondary, flexShrink: 1 },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    badgeStrong: { backgroundColor: c.status.success.surface },
    badgeModerate: { backgroundColor: c.status.warning.surface },
    badgeLimited: { backgroundColor: c.status.error.surface },
    badgeText: { fontSize: 10, fontWeight: "700", color: c.text },
    uncurated: { fontSize: 11, color: c.status.error.strong, marginTop: 4 },
    relevanceTrack: {
      height: 6,
      backgroundColor: c.bgTertiary,
      borderRadius: borderRadius.sm,
      overflow: "hidden",
      marginTop: spacing.sm,
      marginBottom: 4,
    },
    relevanceFill: { height: "100%", backgroundColor: c.accent },
    expanded: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm,
      marginTop: spacing.sm,
    },
    summary: { fontSize: 12, color: c.textBody, lineHeight: 18 },
    path: { fontSize: 11, color: c.textSecondary, marginTop: spacing.sm },
    readMore: {
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    readMoreText: { fontSize: 13, fontWeight: "700", color: c.textOnAccent },
  });
