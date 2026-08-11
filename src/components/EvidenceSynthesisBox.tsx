import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { EvidenceSynthesis } from "../lib/geminiVision";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, type Palette } from "../theme";

export const EVIDENCE_STRENGTH_LABELS: Record<
  EvidenceSynthesis["evidenceStrength"],
  string
> = {
  strong: "Sólida",
  moderate: "Moderada",
  limited: "Limitada",
};

/** Botón que dispara la síntesis clínica sobre la evidencia ya cargada. */
export function SynthesizeButton({
  synthesizing,
  onPress,
}: {
  synthesizing: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={[styles.synthesizeButton, synthesizing && styles.disabled]}
      onPress={onPress}
      disabled={synthesizing}
      accessibilityRole="button"
    >
      <Text style={styles.synthesizeButtonText}>
        {synthesizing ? "Revisando evidencia..." : "Generar resumen clínico"}
      </Text>
    </Pressable>
  );
}

/** Resumen clínico generado a partir de los papers activados. */
export function EvidenceSynthesisBox({ synthesis }: { synthesis: EvidenceSynthesis }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.synthesisBox} testID="evidence-synthesis">
      <Text style={styles.synthesisStrength}>
        Solidez de la evidencia: {EVIDENCE_STRENGTH_LABELS[synthesis.evidenceStrength]}
      </Text>
      <Text style={styles.synthesisSectionTitle}>Etiología</Text>
      <Text style={styles.synthesisText}>{synthesis.etiology}</Text>
      <Text style={styles.synthesisSectionTitle}>Manejo (temas para tu médico)</Text>
      <Text style={styles.synthesisText}>{synthesis.management}</Text>
      <Text style={styles.synthesisSectionTitle}>Resultado probable</Text>
      <Text style={styles.synthesisText}>{synthesis.likelyOutcome}</Text>
      {synthesis.caveats && (
        <>
          <Text style={styles.synthesisSectionTitle}>Advertencias</Text>
          <Text style={styles.synthesisCaveats}>{synthesis.caveats}</Text>
        </>
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    synthesizeButton: {
      backgroundColor: c.inverseSurface,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    synthesizeButtonText: { color: c.onInverseSurface, fontSize: 13, fontWeight: "700" },
    disabled: { opacity: 0.6 },
    synthesisBox: {
      backgroundColor: c.status.info.surface,
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
    },
    synthesisStrength: {
      fontSize: 11,
      fontWeight: "700",
      color: c.status.info.strong,
      marginBottom: 6,
    },
    synthesisSectionTitle: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6 },
    synthesisText: { fontSize: 12, color: c.textBody, lineHeight: 17, marginTop: 2 },
    synthesisCaveats: {
      fontSize: 11,
      color: c.status.warning.strong,
      lineHeight: 16,
      marginTop: 2,
      fontStyle: "italic",
    },
  });
