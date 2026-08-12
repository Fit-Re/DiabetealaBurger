import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import AddReadingScreen from "./AddReadingScreen";
import ImportScreenshotScreen from "./ImportScreenshotScreen";
import MealsScreen from "./MealsScreen";
import MedicationsScreen from "./MedicationsScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, borderRadius, MIN_TOUCH_TARGET, type Palette } from "../theme";

/**
 * Las tres pantallas de registro viven bajo una sola pestaña para no pasar de
 * cinco en la barra inferior.
 *
 * Los segmentos están aplanados a un solo nivel a propósito. Glucosa tenía su
 * propio segmentado interno (Manual / Captura LibreLink); anidarlo aquí dejaba
 * dos controles idénticos apilados, que es justo lo que confunde. En vez de eso
 * "Captura" sube a este nivel y GlucoseScreen deja de hacer de contenedor.
 */
export type Mode = "glucosa" | "captura" | "comida" | "medicamentos";

const MODES: { key: Mode; label: string }[] = [
  { key: "glucosa", label: "Glucosa" },
  { key: "captura", label: "Captura" },
  { key: "comida", label: "Comida" },
  { key: "medicamentos", label: "Medicinas" },
];

export function RegistrarSegments({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (next: Mode) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.segmented}>
      {MODES.map((option) => {
        const active = option.key === mode;
        return (
          <Pressable
            key={option.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={`registrar-${option.key}${active ? "-active" : ""}`}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RegistrarScreen() {
  const [mode, setMode] = useState<Mode>("glucosa");
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <RegistrarSegments mode={mode} onChange={setMode} />

      {mode === "glucosa" && <AddReadingScreen onSaved={() => setMode("glucosa")} />}
      {mode === "captura" && <ImportScreenshotScreen onSaved={() => setMode("captura")} />}
      {mode === "comida" && <MealsScreen />}
      {mode === "medicamentos" && <MedicationsScreen />}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary },
    segmented: {
      flexDirection: "row",
      backgroundColor: c.surface,
      margin: spacing.md,
      marginBottom: 0,
      borderRadius: 10,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    segment: {
      flex: 1,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
      borderRadius: borderRadius.md,
    },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 12, fontWeight: "600", color: c.textBody },
    segmentTextActive: { color: c.textOnAccent },
  });
