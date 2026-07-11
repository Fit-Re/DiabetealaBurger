import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { clearApiKey, getApiKey, setApiKey } from "../lib/anthropic";

export default function SettingsScreen() {
  const [key, setKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    getApiKey().then((existing) => {
      setHasStoredKey(!!existing);
    });
  }, []);

  const onSave = async () => {
    if (!key.trim().startsWith("sk-ant-")) {
      Alert.alert(
        "Verifica tu API key",
        "Las API keys de Anthropic normalmente empiezan con 'sk-ant-'. ¿Quieres guardarla de todas formas?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar de todas formas", onPress: doSave },
        ]
      );
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    await setApiKey(key);
    setHasStoredKey(true);
    setKey("");
    Alert.alert("Guardado", "Tu API key se guardó de forma segura en este dispositivo.");
  };

  const onClear = () => {
    Alert.alert("Eliminar API key", "¿Seguro que quieres eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await clearApiKey();
          setHasStoredKey(false);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ajustes</Text>

      <Text style={styles.sectionTitle}>API key de Anthropic (Claude)</Text>
      <Text style={styles.description}>
        Se usa únicamente para analizar tus capturas de LibreLink y extraer el valor de
        glucosa. Se guarda cifrada en este dispositivo y nunca se comparte.
      </Text>

      <Text style={styles.status}>
        Estado: {hasStoredKey ? "✅ Configurada" : "⚠️ No configurada"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="sk-ant-..."
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Guardar API key</Text>
      </Pressable>

      {hasStoredKey && (
        <Pressable style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearButtonText}>Eliminar API key guardada</Text>
        </Pressable>
      )}

      <Text style={styles.disclaimer}>
        Esta app es una herramienta de registro y apoyo personal para el manejo de
        diabetes tipo 1. No sustituye el diagnóstico, tratamiento ni las indicaciones de
        tu médico o equipo de endocrinología. Ante síntomas de hipo/hiperglucemia
        severa, contacta a tu equipo médico o servicios de emergencia.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: "#111827" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 6 },
  description: { fontSize: 13, color: "#6b7280", marginBottom: 10, lineHeight: 18 },
  status: { fontSize: 13, color: "#374151", marginBottom: 10, fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  clearButton: { alignItems: "center", padding: 12, marginTop: 8 },
  clearButtonText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 32,
    marginBottom: 40,
    fontStyle: "italic",
    lineHeight: 16,
  },
});
