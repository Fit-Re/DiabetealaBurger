import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  computeMealTotals,
  deleteMeal,
  getMealsSince,
  insertMeal,
} from "../db/database";
import { parseMealPhoto } from "../lib/anthropic";
import type { ParsedMeal } from "../lib/anthropic";
import type { Meal } from "../types";

function startOfTodayMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [calories, setCalories] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [sugarG, setSugarG] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");

  const load = useCallback(async () => {
    const rows = await getMealsSince(startOfTodayMs());
    setMeals(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setImageUri(null);
    setBase64(null);
    setContext("");
    setParsed(null);
    setAnswers({});
    setCalories("");
    setCarbsG("");
    setSugarG("");
    setProteinG("");
    setFatG("");
  };

  const applyParsed = (result: ParsedMeal) => {
    setParsed(result);
    setCalories(result.calories != null ? String(result.calories) : "");
    setCarbsG(result.carbsG != null ? String(result.carbsG) : "");
    setSugarG(result.sugarG != null ? String(result.sugarG) : "");
    setProteinG(result.proteinG != null ? String(result.proteinG) : "");
    setFatG(result.fatG != null ? String(result.fatG) : "");
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu cámara para tomar la foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setBase64(result.assets[0].base64 ?? null);
      setParsed(null);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para elegir la imagen.");
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
      const result = await parseMealPhoto(base64, "image/jpeg", context.trim() || null, []);
      applyParsed(result);
      setAnswers({});
    } catch (e: any) {
      Alert.alert("No se pudo analizar", e?.message ?? "Error desconocido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reanalyzeWithAnswers = async () => {
    if (!base64 || !parsed) return;
    const clarifications = parsed.clarifyingQuestions
      .map((q) => ({ question: q, answer: (answers[q] ?? "").trim() }))
      .filter((c) => c.answer.length > 0);
    if (clarifications.length === 0) {
      Alert.alert("Responde al menos una pregunta", "Escribe una respuesta antes de reanalizar.");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await parseMealPhoto(
        base64,
        "image/jpeg",
        context.trim() || null,
        clarifications
      );
      applyParsed(result);
      setAnswers({});
    } catch (e: any) {
      Alert.alert("No se pudo reanalizar", e?.message ?? "Error desconocido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const hasAnyValue = [calories, carbsG, sugarG, proteinG, fatG].some(
      (v) => v.trim().length > 0
    );
    if (!hasAnyValue && !context.trim()) {
      Alert.alert(
        "Faltan datos",
        "Escribe al menos las calorías o los carbohidratos, o una descripción de la comida."
      );
      return;
    }
    setSaving(true);
    try {
      await insertMeal({
        timestampMs: Date.now(),
        description: context.trim() || null,
        calories: calories ? Number(calories.replace(",", ".")) : null,
        carbsG: carbsG ? Number(carbsG.replace(",", ".")) : null,
        sugarG: sugarG ? Number(sugarG.replace(",", ".")) : null,
        proteinG: proteinG ? Number(proteinG.replace(",", ".")) : null,
        fatG: fatG ? Number(fatG.replace(",", ".")) : null,
        portionEstimate: parsed?.portionEstimate ?? null,
        items: parsed?.items ?? [],
        source: parsed ? "photo" : "manual",
        aiNotes: parsed?.aiNotes ?? null,
      });
      resetForm();
      setShowAddForm(false);
      Alert.alert("Guardado", "La comida se registró correctamente.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar la comida.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id: number) => {
    Alert.alert("Eliminar comida", "¿Seguro que quieres eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteMeal(id);
          load();
        },
      },
    ]);
  };

  const totals = computeMealTotals(meals);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Comida de hoy</Text>

      <View style={styles.statsRow}>
        <StatCard label="Calorías" value={totals.calories.toFixed(0)} />
        <StatCard label="Carbs (g)" value={totals.carbsG.toFixed(0)} />
        <StatCard label="Azúcar (g)" value={totals.sugarG.toFixed(0)} />
      </View>

      {meals.map((m) => (
        <Pressable key={m.id} style={styles.mealCard} onLongPress={() => onDelete(m.id)}>
          <View style={styles.flex1}>
            <Text style={styles.mealTime}>
              {new Date(m.timestampMs).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text style={styles.mealMacros}>
              {m.calories?.toFixed(0) ?? "--"} kcal · {m.carbsG?.toFixed(0) ?? "--"}g carbs ·{" "}
              {m.sugarG?.toFixed(0) ?? "--"}g azúcar
            </Text>
            {m.portionEstimate && (
              <Text style={styles.mealPortion}>{m.portionEstimate}</Text>
            )}
          </View>
        </Pressable>
      ))}
      {meals.length > 0 && (
        <Text style={styles.hint}>Mantén presionada una comida para eliminarla.</Text>
      )}

      {!showAddForm && (
        <Pressable style={styles.addButton} onPress={() => setShowAddForm(true)}>
          <Text style={styles.addButtonText}>+ Agregar comida</Text>
        </Pressable>
      )}

      {showAddForm && (
        <View style={styles.formBox}>
          <Text style={styles.formHint}>
            Escribe tú mismo las calorías/carbohidratos (gratis, sin IA), o toma/elige una
            foto y usa el análisis automático si tienes crédito de Anthropic configurado.
          </Text>

          <View style={styles.row}>
            <Pressable style={styles.pickButton} onPress={takePhoto}>
              <Text style={styles.pickButtonText}>Tomar foto (opcional)</Text>
            </Pressable>
            <Pressable style={styles.pickButton} onPress={pickFromGallery}>
              <Text style={styles.pickButtonText}>Elegir de galería (opcional)</Text>
            </Pressable>
          </View>

          {imageUri && (
            <>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <Pressable
                style={[styles.analyzeButton, analyzing && styles.disabled]}
                onPress={analyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.analyzeButtonText}>
                    Analizar con IA (opcional, usa crédito)
                  </Text>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Ej. 2 tacos de pollo con arroz y una manzana"
            value={context}
            onChangeText={setContext}
            multiline
          />

          {parsed && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>
                Alimentos identificados por IA (confianza: {parsed.confidence})
              </Text>
              {parsed.items.map((item, idx) => (
                <Text key={idx} style={styles.itemLine}>
                  • {item.name} {item.portionEstimate ? `(${item.portionEstimate})` : ""} —{" "}
                  {item.carbsG ?? "--"}g carbs, {item.calories ?? "--"} kcal
                </Text>
              ))}

              {parsed.clarifyingQuestions.length > 0 && (
                <View style={styles.clarifyBox}>
                  <Text style={styles.clarifyTitle}>
                    Para afinar el cálculo, ¿puedes responder?
                  </Text>
                  {parsed.clarifyingQuestions.map((q) => (
                    <View key={q}>
                      <Text style={styles.label}>{q}</Text>
                      <TextInput
                        style={styles.input}
                        value={answers[q] ?? ""}
                        onChangeText={(v) => setAnswers({ ...answers, [q]: v })}
                      />
                    </View>
                  ))}
                  <Pressable
                    style={[styles.analyzeButton, analyzing && styles.disabled]}
                    onPress={reanalyzeWithAnswers}
                    disabled={analyzing}
                  >
                    <Text style={styles.analyzeButtonText}>
                      {analyzing ? "Reanalizando..." : "Reanalizar con estas respuestas"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {parsed.aiNotes && (
                <Text style={styles.note}>Nota de la IA: {parsed.aiNotes}</Text>
              )}
            </View>
          )}

          <Text style={styles.label}>Calorías totales</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Ej. 450"
            value={calories}
            onChangeText={setCalories}
          />
          <Text style={styles.label}>Carbohidratos (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Ej. 55"
            value={carbsG}
            onChangeText={setCarbsG}
          />
          <Text style={styles.label}>Azúcar (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Ej. 8"
            value={sugarG}
            onChangeText={setSugarG}
          />
          <Text style={styles.label}>Proteína (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Ej. 20"
            value={proteinG}
            onChangeText={setProteinG}
          />
          <Text style={styles.label}>Grasa (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Ej. 15"
            value={fatG}
            onChangeText={setFatG}
          />

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                resetForm();
                setShowAddForm(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, saving && styles.disabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Guardando..." : "Guardar comida"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.disclaimer}>
        Las estimaciones de macros son una guía de apoyo generada por IA y pueden
        tener margen de error. Ajusta tu dosis de insulina según lo indicado por tu
        equipo médico.
      </Text>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12, color: "#111827" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  mealCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  mealThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e5e7eb" },
  flex1: { flex: 1 },
  mealTime: { fontSize: 13, fontWeight: "700", color: "#111827" },
  mealMacros: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  mealPortion: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  hint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 8 },
  addButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  addButtonText: { color: "#2563eb", fontWeight: "700" },
  formBox: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 },
  formHint: { fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 17 },
  row: { flexDirection: "row", gap: 8 },
  pickButton: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickButtonText: { color: "#2563eb", fontWeight: "600", fontSize: 13 },
  preview: { width: "100%", height: 220, marginTop: 12, borderRadius: 12, backgroundColor: "#000" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  notesInput: { minHeight: 60, textAlignVertical: "top" },
  analyzeButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  analyzeButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.6 },
  resultBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12 },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 8 },
  itemLine: { fontSize: 12, color: "#374151", marginBottom: 4 },
  clarifyBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  clarifyTitle: { fontSize: 12, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginTop: 8, fontStyle: "italic" },
  formActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelButtonText: { color: "#374151", fontWeight: "600" },
  saveButton: { flex: 1, backgroundColor: "#2563eb", paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
    fontStyle: "italic",
  },
});
