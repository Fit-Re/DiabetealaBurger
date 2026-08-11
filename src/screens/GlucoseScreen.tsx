import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import AddReadingScreen from "./AddReadingScreen";
import ImportScreenshotScreen from "./ImportScreenshotScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Palette } from "../theme";

type Mode = "manual" | "screenshot";

export default function GlucoseScreen() {
  const [mode, setMode] = useState<Mode>("manual");
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segment, mode === "manual" && styles.segmentActive]}
          onPress={() => setMode("manual")}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "manual" && styles.segmentTextActive,
            ]}
          >
            Manual
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, mode === "screenshot" && styles.segmentActive]}
          onPress={() => setMode("screenshot")}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "screenshot" && styles.segmentTextActive,
            ]}
          >
            Captura LibreLink
          </Text>
        </Pressable>
      </View>

      {mode === "manual" ? (
        <AddReadingScreen onSaved={() => setMode("manual")} />
      ) : (
        <ImportScreenshotScreen onSaved={() => setMode("screenshot")} />
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary },
    segmented: {
      flexDirection: "row",
      backgroundColor: c.surface,
      margin: 16,
      marginBottom: 0,
      borderRadius: 10,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, fontWeight: "600", color: c.textBody },
    segmentTextActive: { color: c.textOnAccent },
  });
