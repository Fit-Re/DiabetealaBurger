import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { insertReading } from "../db/database";
import { parseLibreLinkScreenshot } from "../lib/geminiVision";
import { runBackgroundTasks } from "../lib/autoEnrich";
import { parseLibreLinkScreenshotOCR } from "../lib/ocrSpace";
import type { TrendArrow } from "../types";
import { TREND_LABELS } from "../types";

const TREND_OPTIONS: { key: TrendArrow; label: string }[] = [
  { key: "rising_fast", label: TREND_LABELS.rising_fast },
  { key: "rising", label: TREND_LABELS.rising },
  { key: "steady", label: TREND_LABELS.steady },
  { key: "falling", label: TREND_LABELS.falling },
  { key: "falling_fast", label: TREND_LABELS.falling_fast },
];

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function parseTimeToday(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const now = new Date();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate.getTime();
}

export default function ImportScreenshotScreen({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingOcr, setAnalyzingOcr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);

  const [value, setValue] = useState("");
  const [trend, setTrend] = useState<TrendArrow>(null);
  const [timeInput, setTimeInput] = useState(currentTimeHHMM());
  const [notes, setNotes] = useState("");

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para ver la captura.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setBase64(result.assets[0].base64 ?? null);
    }
  };

  const analyze = async () => {
    if (!base64) return;
    setAnalyzing(true);
    try {
      const result = await parseLibreLinkScreenshot(base64);
      setValue(String(result.value));
      setTrend(result.trend);
      if (result.timestampMs) {
        const d = new Date(result.timestampMs);
        setTimeInput(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }
      if (result.rawNote) setNotes(result.rawNote);
      setConfidence(result.confidence);
    } catch (e: any) {
      Alert.alert(
        "No se pudo analizar con IA",
        `${e?.message ?? "Error desconocido."}\n\nPuedes seguir capturando el valor manualmente abajo.`
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeOcr = async () => {
    if (!base64) return;
    setAnalyzingOcr(true);
    try {
      const result = await parseLibreLinkScreenshotOCR(base64);
      setValue(String(result.value));
      setTrend(result.trend);
      if (result.timestampMs) {
        const d = new Date(result.timestampMs);
        setTimeInput(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }
      if (result.rawNote) setNotes(result.rawNote);
      setConfidence(result.confidence);
    } catch (e: any) {
      Alert.alert(
        "No se pudo leer con OCR",
        `${e?.message ?? "Error desconocido."}\n\nPuedes seguir capturando el valor manualmente abajo.`
      );
    } finally {
      setAnalyzingOcr(false);
    }
  };

  const resetForm = () => {
    setImageUri(null);
    setBase64(null);
    setConfidence(null);
    setValue("");
    setTrend(null);
    setTimeInput(currentTimeHHMM());
    setNotes("");
  };

  const save = async () => {
    const numeric = Number(value.replace(",", "."));
    if (!value || Number.isNaN(numeric) || numeric <= 0) {
      Alert.alert("Valor inválido", "Ingresa el valor de glucosa que ves en la captura.");
      return;
    }
    const timestampMs = parseTimeToday(timeInput) ?? Date.now();
    setSaving(true);
    try {
      await insertReading({
        value: numeric,
        unit: "mg/dL",
        timestampMs,
        source: "librelink",
        trend,
        notes: notes.trim() || null,
      });
      Alert.alert("Guardado", "La lectura se registró correctamente.");
      resetForm();
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
      <Text style={styles.title}>Importar captura de LibreLink</Text>
      <Text style={styles.hint}>
        Puedes escribir el valor tú mismo viendo la captura (gratis), autocompletarlo con OCR
        (también gratis, lee el número pero no la flecha de tendencia), o con IA si tienes
        tu API key de Gemini configurada (gratis, más preciso, también detecta la tendencia).
      </Text>

      <Pressable style={styles.pickButton} onPress={pickImage}>
        <Text style={styles.pickButtonText}>
          {imageUri ? "Cambiar captura" : "Elegir captura de la galería (opcional)"}
        </Text>
      </Pressable>

      {imageUri && (
        <>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <Pressable
            style={[styles.ocrButton, analyzingOcr && styles.disabled]}
            onPress={analyzeOcr}
            disabled={analyzingOcr || analyzing}
          >
            {analyzingOcr ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeButtonText}>Autocompletar con OCR (gratis)</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.analyzeButton, analyzing && styles.disabled]}
            onPress={analyze}
            disabled={analyzing || analyzingOcr}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeButtonText}>
                Autocompletar con IA (opcional, usa crédito)
              </Text>
            )}
          </Pressable>
        </>
      )}

      <View style={styles.formBox}>
        {confidence && (
          <Text style={styles.confidenceText}>
            Autocompletado por IA (confianza: {confidence}) — revisa antes de guardar.
          </Text>
        )}

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
              style={[styles.trendChip, trend === opt.key && styles.trendChipSelected]}
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

        <Text style={styles.label}>Hora (HH:MM, 24h)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 08:30"
          value={timeInput}
          onChangeText={setTimeInput}
        />

        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Ej. antes de comer..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Guardando..." : "Guardar lectura"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: "#111827" },
  hint: { fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 17 },
  pickButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickButtonText: { color: "#2563eb", fontWeight: "600", fontSize: 15 },
  preview: { width: "100%", height: 260, marginTop: 16, borderRadius: 12, backgroundColor: "#000" },
  analyzeButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  analyzeButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  ocrButton: {
    backgroundColor: "#059669",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  disabled: { opacity: 0.6 },
  formBox: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 16 },
  confidenceText: {
    fontSize: 12,
    color: "#4338ca",
    backgroundColor: "#eef2ff",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  notesInput: { minHeight: 60, textAlignVertical: "top" },
  trendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trendChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  trendChipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  trendChipText: { fontSize: 12, color: "#374151" },
  trendChipTextSelected: { color: "#fff" },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
