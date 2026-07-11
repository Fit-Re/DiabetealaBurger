import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { insertReading } from "../db/database";
import type { TrendArrow } from "../types";
import { TREND_LABELS } from "../types";

const TREND_OPTIONS: { key: TrendArrow; label: string }[] = [
  { key: "rising_fast", label: TREND_LABELS.rising_fast },
  { key: "rising", label: TREND_LABELS.rising },
  { key: "steady", label: TREND_LABELS.steady },
  { key: "falling", label: TREND_LABELS.falling },
  { key: "falling_fast", label: TREND_LABELS.falling_fast },
];

export default function AddReadingScreen({ onSaved }: { onSaved?: () => void }) {
  const [value, setValue] = useState("");
  const [trend, setTrend] = useState<TrendArrow>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const numeric = Number(value.replace(",", "."));
    if (!value || Number.isNaN(numeric) || numeric <= 0) {
      Alert.alert("Valor inválido", "Ingresa un valor de glucosa válido.");
      return;
    }
    setSaving(true);
    try {
      await insertReading({
        value: numeric,
        unit: "mg/dL",
        timestampMs: Date.now(),
        source: "manual",
        trend,
        notes: notes.trim() || null,
      });
      setValue("");
      setTrend(null);
      setNotes("");
      Alert.alert("Guardado", "La lectura se registró correctamente.");
      onSaved?.();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar la lectura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Valor de glucosa (mg/dL)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Ej. 110"
        value={value}
        onChangeText={setValue}
      />

      <Text style={styles.label}>Tendencia (opcional)</Text>
      <View style={styles.trendGrid}>
        {TREND_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[
              styles.trendChip,
              trend === opt.key && styles.trendChipSelected,
            ]}
            onPress={() => setTrend(trend === opt.key ? null : opt.key)}
          >
            <Text
              style={[
                styles.trendChipText,
                trend === opt.key && styles.trendChipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Notas (opcional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Ej. después de correr, antes de comer..."
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Text style={styles.hint}>La hora se registra automáticamente (ahora).</Text>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Guardando..." : "Guardar lectura"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  trendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trendChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  trendChipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  trendChipText: { fontSize: 13, color: "#374151" },
  trendChipTextSelected: { color: "#fff" },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 16, textAlign: "center" },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
