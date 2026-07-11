import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import AddReadingScreen from "./AddReadingScreen";
import ImportScreenshotScreen from "./ImportScreenshotScreen";

type Mode = "manual" | "screenshot";

export default function GlucoseScreen() {
  const [mode, setMode] = useState<Mode>("manual");

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 0,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: "#2563eb" },
  segmentText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  segmentTextActive: { color: "#fff" },
});
