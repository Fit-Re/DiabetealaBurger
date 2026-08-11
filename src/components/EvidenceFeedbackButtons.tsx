import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, type Palette } from "../theme";

/**
 * Par de botones "útil / no ayudó" con los que el paciente califica un paper.
 * Alimenta el ranking por feedback (pattern memory) y lo consumen tanto la
 * tarjeta de patrón de Inicio como la pantalla de Evidencia.
 */
export function EvidenceFeedbackButtons({
  value,
  onPress,
}: {
  /** true/false si ya se calificó, null o undefined si todavía no. */
  value: boolean | null | undefined;
  onPress: (wasHelpful: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, value === true && styles.buttonActive]}
        onPress={() => onPress(true)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === true }}
        accessibilityLabel="Marcar este artículo como útil"
      >
        <Text style={[styles.text, value === true && styles.textActive]}>👍 Útil</Text>
      </Pressable>
      <Pressable
        style={[styles.button, value === false && styles.buttonActive]}
        onPress={() => onPress(false)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === false }}
        accessibilityLabel="Marcar este artículo como no útil"
      >
        <Text style={[styles.text, value === false && styles.textActive]}>👎 No ayudó</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.sm, marginTop: 10 },
    button: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
      alignItems: "center",
    },
    buttonActive: { backgroundColor: c.accentLight, borderColor: c.accent },
    text: { fontSize: 12, fontWeight: "600", color: c.textSecondary },
    textActive: { color: c.accent },
  });
