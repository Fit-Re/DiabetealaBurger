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
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { insertReading } from "../db/database";
import { parseLibreLinkScreenshot } from "../lib/anthropic";
import type { ParsedLibreLinkReading } from "../lib/anthropic";
import type { GlucoseUnit, TrendArrow } from "../types";
import { TREND_LABELS } from "../types";

export default function ImportScreenshotScreen() {
  const navigation = useNavigation();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedLibreLinkReading | null>(null);
  const [editedValue, setEditedValue] = useState("");
  const [editedTime, setEditedTime] = useState<Date>(new Date());

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para importar la captura.");
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
      setParsed(null);
    }
  };

  const analyze = async () => {
    if (!base64) return;
    setAnalyzing(true);
    try {
      const result = await parseLibreLinkScreenshot(base64);
      setParsed(result);
      setEditedValue(String(result.value));
      setEditedTime(result.timestampMs ? new Date(result.timestampMs) : new Date());
    } catch (e: any) {
      Alert.alert("No se pudo analizar", e?.message ?? "Error desconocido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const numeric = Number(editedValue.replace(",", "."));
    if (!editedValue || Number.isNaN(numeric) || numeric <= 0) {
      Alert.alert("Valor inválido", "Revisa el valor de glucosa antes de guardar.");
      return;
    }
    setSaving(true);
    try {
      await insertReading({
        value: numeric,
        unit: (parsed?.unit ?? "mg/dL") as GlucoseUnit,
        timestampMs: editedTime.getTime(),
        source: "librelink",
        trend: (parsed?.trend ?? null) as TrendArrow,
        notes: parsed?.rawNote ?? null,
      });
      Alert.alert("Guardado", "La lectura se registró correctamente.");
      setImageUri(null);
      setBase64(null);
      setParsed(null);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar la lectura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Importar captura de LibreLink</Text>

      <Pressable style={styles.pickButton} onPress={pickImage}>
        <Text style={styles.pickButtonText}>
          {imageUri ? "Cambiar captura" : "Elegir captura de la galería"}
        </Text>
      </Pressable>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
      )}

      {imageUri && !parsed && (
        <Pressable
          style={[styles.analyzeButton, analyzing && styles.disabled]}
          onPress={analyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analizar con IA</Text>
          )}
        </Pressable>
      )}

      {parsed && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>
            Revisa y ajusta antes de guardar (confianza: {parsed.confidence})
          </Text>

          <Text style={styles.label}>Valor de glucosa</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={editedValue}
            onChangeText={setEditedValue}
          />

          <Text style={styles.label}>Unidad</Text>
          <Text style={styles.readOnlyValue}>{parsed.unit}</Text>

          <Text style={styles.label}>Tendencia detectada</Text>
          <Text style={styles.readOnlyValue}>
            {parsed.trend ? TREND_LABELS[parsed.trend] : "No detectada"}
          </Text>

          <Text style={styles.label}>Hora detectada</Text>
          <Text style={styles.readOnlyValue}>
            {parsed.timestampMs
              ? editedTime.toLocaleString("es-MX")
              : "No detectada — se usará la hora actual"}
          </Text>

          {parsed.rawNote && (
            <Text style={styles.note}>Nota de la IA: {parsed.rawNote}</Text>
          )}

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
      )}

      <Text style={styles.hint}>
        Necesitas configurar tu API key de Anthropic en Ajustes para usar el análisis con IA.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: "#111827" },
  pickButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickButtonText: { color: "#2563eb", fontWeight: "600", fontSize: 15 },
  preview: { width: "100%", height: 300, marginTop: 16, borderRadius: 12, backgroundColor: "#000" },
  analyzeButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  analyzeButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
  resultBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  resultTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12, color: "#111827" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 8 },
  readOnlyValue: { fontSize: 15, color: "#111827" },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  note: { fontSize: 12, color: "#6b7280", marginTop: 8, fontStyle: "italic" },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 20, marginBottom: 40, textAlign: "center" },
});
