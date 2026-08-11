import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { ThemedTextInput } from "../components/ThemedTextInput";
import DateTimePicker from "@react-native-community/datetimepicker";
import { insertReading } from "../db/database";
import { runBackgroundTasks } from "../lib/autoEnrich";
import type { TrendArrow } from "../types";
import { TREND_LABELS } from "../types";
import { mergeDatePart, mergeTimePart, formatDate, formatTime } from "../lib/dateTimeUtils";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Palette } from "../theme";

const TREND_OPTIONS: { key: TrendArrow; label: string }[] = [
  { key: "rising_fast", label: TREND_LABELS.rising_fast },
  { key: "rising", label: TREND_LABELS.rising },
  { key: "steady", label: TREND_LABELS.steady },
  { key: "falling", label: TREND_LABELS.falling },
  { key: "falling_fast", label: TREND_LABELS.falling_fast },
];

export default function AddReadingScreen({ onSaved }: { onSaved?: () => void }) {
  const styles = useThemedStyles(createStyles);
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
      <ThemedTextInput
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
      <ThemedTextInput
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

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary, padding: 16 },
    label: { fontSize: 14, fontWeight: "600", color: c.textBody, marginBottom: 6, marginTop: 12 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    pickerText: { fontSize: 15, color: c.text, textAlign: "center" },
    row: { flexDirection: "row" },
    flex1: { flex: 1 },
    marginLeft: { marginLeft: 8 },
    pickerBox: {
      backgroundColor: c.surface,
      borderRadius: 10,
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      paddingBottom: 8,
    },
    doneButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 24,
      marginTop: 4,
    },
    doneButtonText: { color: c.textOnAccent, fontWeight: "700" },
    notesInput: { minHeight: 80, textAlignVertical: "top" },
    trendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    trendChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    trendChipSelected: { backgroundColor: c.accent, borderColor: c.accent },
    trendChipText: { fontSize: 13, color: c.textBody },
    trendChipTextSelected: { color: c.textOnAccent },
    hint: { fontSize: 12, color: c.textMuted, marginTop: 6 },
    saveButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 20,
      marginBottom: 40,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: c.textOnAccent, fontSize: 16, fontWeight: "700" },
  });
