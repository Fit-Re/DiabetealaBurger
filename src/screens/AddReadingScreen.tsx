import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { insertReading } from "../db/database";
import { runBackgroundTasks } from "../lib/autoEnrich";
import type { TrendArrow } from "../types";
import { TREND_LABELS } from "../types";
import { mergeDatePart, mergeTimePart, formatDate, formatTime } from "../lib/dateTimeUtils";

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
  const [dateTime, setDateTime] = useState(() => new Date());
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);

  const openPicker = (mode: "date" | "time") => setPickerMode(mode);

  const onPickerChange = (event: { type: string }, selected?: Date) => {
    if (Platform.OS === "android") setPickerMode(null);
    if (event.type === "dismissed" || !selected) return;
    setDateTime((prev) =>
      pickerMode === "date" ? mergeDatePart(prev, selected) : mergeTimePart(prev, selected)
    );
  };

  const onSave = async () => {
    const numeric = Number(value.replace(",", "."));
    if (!value || Number.isNaN(numeric) || numeric <= 0) {
      Alert.alert("Valor inválido", "Ingresa un valor de glucosa válido.");
      return;
    }
    if (dateTime.getTime() > Date.now()) {
      Alert.alert("Fecha inválida", "No puedes registrar una lectura en el futuro.");
      return;
    }
    setSaving(true);
    try {
      await insertReading({
        value: numeric,
        unit: "mg/dL",
        timestampMs: dateTime.getTime(),
        source: "manual",
        trend,
        notes: notes.trim() || null,
      });
      setValue("");
      setTrend(null);
      setNotes("");
      setDateTime(new Date());
      Alert.alert("Guardado", "La lectura se registró correctamente.");
      runBackgroundTasks();
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

      <Text style={styles.label}>Día y hora de la lectura</Text>
      <View style={styles.row}>
        <Pressable style={[styles.input, styles.flex1]} onPress={() => openPicker("date")}>
          <Text style={styles.pickerText}>{formatDate(dateTime)}</Text>
        </Pressable>
        <Pressable
          style={[styles.input, styles.flex1, styles.marginLeft]}
          onPress={() => openPicker("time")}
        >
          <Text style={styles.pickerText}>{formatTime(dateTime)}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Por defecto es ahora — tocá fecha u hora para cargar una lectura de otro momento.
      </Text>

      {pickerMode && (
        <View style={styles.pickerBox}>
          <DateTimePicker
            value={dateTime}
            mode={pickerMode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={onPickerChange}
          />
          {Platform.OS === "ios" && (
            <Pressable style={styles.doneButton} onPress={() => setPickerMode(null)}>
              <Text style={styles.doneButtonText}>Listo</Text>
            </Pressable>
          )}
        </View>
      )}

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
  pickerText: { fontSize: 15, color: "#111827", textAlign: "center" },
  row: { flexDirection: "row" },
  flex1: { flex: 1 },
  marginLeft: { marginLeft: 8 },
  pickerBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    paddingBottom: 8,
  },
  doneButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  doneButtonText: { color: "#fff", fontWeight: "700" },
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
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 6 },
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
