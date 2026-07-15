import React, { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  deleteMedication,
  getActiveMedications,
  getMedicationLogsSince,
  insertMedication,
  insertMedicationLog,
  updateMedicationNotificationIds,
} from "../db/database";
import { runBackgroundEnrichment } from "../lib/autoEnrich";
import {
  cancelNotifications,
  scheduleMedicationReminders,
} from "../lib/notifications";
import type { Medication, MedicationLog, MedicationType, KnowledgeSearchResult } from "../types";
import { MEDICATION_TYPE_LABELS } from "../types";
import { mergeDatePart, mergeTimePart, formatDate, formatTime } from "../lib/dateTimeUtils";
import {
  findInteractionNotes,
  findMedicationReference,
  searchMedicationReference,
} from "../data/medicationReference";
import { searchKnowledge } from "../lib/knowledgeBase";

const TYPE_OPTIONS: MedicationType[] = [
  "insulin_basal",
  "insulin_bolus",
  "sensitizer",
  "supplement",
  "other",
];

function startOfTodayMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export default function MedicationsScreen() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logsToday, setLogsToday] = useState<MedicationLog[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<MedicationType>("insulin_bolus");
  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState("unidades");
  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [loggingMedication, setLoggingMedication] = useState<Medication | null>(null);
  const [logDoseAmount, setLogDoseAmount] = useState("");
  const [logDateTime, setLogDateTime] = useState(() => new Date());
  const [logPickerMode, setLogPickerMode] = useState<"date" | "time" | null>(null);
  const [loggingSaving, setLoggingSaving] = useState(false);

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceResults, setEvidenceResults] = useState<KnowledgeSearchResult[] | null>(null);

  const nameSuggestions = useMemo(
    () => (showNameSuggestions ? searchMedicationReference(name) : []),
    [name, showNameSuggestions]
  );
  const matchedReference = useMemo(() => findMedicationReference(name), [name]);
  const interactionNotes = useMemo(
    () => findInteractionNotes(medications.map((m) => m.type)),
    [medications]
  );

  const load = useCallback(async () => {
    const [meds, logs] = await Promise.all([
      getActiveMedications(),
      getMedicationLogsSince(startOfTodayMs()),
    ]);
    setMedications(meds);
    setLogsToday(logs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addTime = () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeInput.trim());
    if (!match) {
      Alert.alert("Hora inválida", "Usa el formato HH:MM, por ejemplo 08:00.");
      return;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      Alert.alert("Hora inválida", "Usa el formato HH:MM, por ejemplo 08:00.");
      return;
    }
    const normalized = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (!scheduleTimes.includes(normalized)) {
      setScheduleTimes([...scheduleTimes, normalized].sort());
    }
    setTimeInput("");
  };

  const removeTime = (t: string) => {
    setScheduleTimes(scheduleTimes.filter((x) => x !== t));
  };

  const resetForm = () => {
    setName("");
    setType("insulin_bolus");
    setDoseAmount("");
    setDoseUnit("unidades");
    setScheduleTimes([]);
    setTimeInput("");
    setNotes("");
    setShowNameSuggestions(false);
    setEvidenceResults(null);
  };

  const onSelectSuggestion = (slug: string) => {
    const entry = searchMedicationReference(name).find((e) => e.slug === slug);
    if (!entry) return;
    setName(entry.names[0]);
    setType(entry.type);
    setShowNameSuggestions(false);
  };

  const onSearchEvidence = async () => {
    if (!matchedReference) return;
    setEvidenceLoading(true);
    setEvidenceResults(null);
    try {
      const results = await searchKnowledge(
        `${matchedReference.names[0]} diabetes tipo 1`,
        { topK: 3 }
      );
      setEvidenceResults(results);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo buscar evidencia relacionada.");
    } finally {
      setEvidenceLoading(false);
    }
  };

  const onSaveMedication = async () => {
    if (!name.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre del medicamento.");
      return;
    }
    const doseNumeric = doseAmount ? Number(doseAmount.replace(",", ".")) : null;
    const ceiling = matchedReference?.doseCeiling;
    if (ceiling && doseNumeric && doseNumeric > ceiling.amount) {
      Alert.alert(
        "Dosis fuera de lo habitual",
        `${ceiling.amount} ${ceiling.unit} es el ${ceiling.note}. Ingresaste ${doseNumeric}. Esto es solo un recordatorio para que lo confirmes con tu equipo médico — puedes guardarlo igual si es correcto.`,
        [
          { text: "Revisar de nuevo", style: "cancel" },
          { text: "Guardar de todas formas", onPress: saveMedication },
        ]
      );
      return;
    }
    await saveMedication();
  };

  const saveMedication = async () => {
    setSaving(true);
    try {
      const doseNumeric = doseAmount ? Number(doseAmount.replace(",", ".")) : null;
      const id = await insertMedication({
        name: name.trim(),
        type,
        doseAmount: doseNumeric && !Number.isNaN(doseNumeric) ? doseNumeric : null,
        doseUnit: doseUnit.trim() || null,
        scheduleTimes,
        notes: notes.trim() || null,
      });

      if (scheduleTimes.length > 0) {
        const doseLabel = doseNumeric ? `${doseNumeric} ${doseUnit}` : "";
        const notificationIds = await scheduleMedicationReminders(
          name.trim(),
          doseLabel,
          scheduleTimes
        );
        if (notificationIds.length > 0) {
          await updateMedicationNotificationIds(id, notificationIds);
        }
      }

      resetForm();
      setShowAddForm(false);
      Alert.alert("Guardado", "El medicamento se registró correctamente.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar el medicamento.");
    } finally {
      setSaving(false);
    }
  };

  const onLogDose = (medication: Medication) => {
    setLoggingMedication(medication);
    setLogDoseAmount(medication.doseAmount != null ? String(medication.doseAmount) : "");
    setLogDateTime(new Date());
    setLogPickerMode(null);
  };

  const onCancelLog = () => {
    setLoggingMedication(null);
    setLogPickerMode(null);
  };

  const onLogPickerChange = (event: { type: string }, selected?: Date) => {
    if (Platform.OS === "android") setLogPickerMode(null);
    if (event.type === "dismissed" || !selected) return;
    setLogDateTime((prev) =>
      logPickerMode === "date" ? mergeDatePart(prev, selected) : mergeTimePart(prev, selected)
    );
  };

  const onConfirmLog = async () => {
    if (!loggingMedication) return;
    if (logDateTime.getTime() > Date.now()) {
      Alert.alert("Fecha inválida", "No puedes registrar una toma en el futuro.");
      return;
    }
    const doseNumeric = logDoseAmount ? Number(logDoseAmount.replace(",", ".")) : null;
    if (logDoseAmount && (doseNumeric === null || Number.isNaN(doseNumeric))) {
      Alert.alert("Dosis inválida", "Ingresa un número válido para la dosis.");
      return;
    }
    setLoggingSaving(true);
    try {
      await insertMedicationLog({
        medicationId: loggingMedication.id,
        takenAtMs: logDateTime.getTime(),
        doseAmount: doseNumeric,
        notes: null,
      });
      runBackgroundEnrichment();
      setLoggingMedication(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo registrar la toma.");
    } finally {
      setLoggingSaving(false);
    }
  };

  const onDelete = (medication: Medication) => {
    Alert.alert(
      "Eliminar medicamento",
      `¿Eliminar ${medication.name} y cancelar sus recordatorios?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await cancelNotifications(medication.notificationIds);
            await deleteMedication(medication.id);
            load();
          },
        },
      ]
    );
  };

  const logsCountFor = (medicationId: number) =>
    logsToday.filter((l) => l.medicationId === medicationId).length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Medicamentos</Text>

      {medications.length === 0 && !showAddForm && (
        <Text style={styles.emptyText}>
          Aún no has agregado medicamentos. Agrega insulinas, sensibilizadores o
          suplementos con su dosis y horario.
        </Text>
      )}

      {interactionNotes.map((note, i) => (
        <View key={i} style={styles.interactionCard}>
          <Text style={styles.interactionText}>ℹ️ {note.note}</Text>
        </View>
      ))}

      {medications.map((m) => (
        <View key={m.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{m.name}</Text>
            <Text style={styles.cardType}>{MEDICATION_TYPE_LABELS[m.type]}</Text>
          </View>
          {m.doseAmount != null && (
            <Text style={styles.cardMeta}>
              Dosis: {m.doseAmount} {m.doseUnit}
            </Text>
          )}
          {m.scheduleTimes.length > 0 && (
            <Text style={styles.cardMeta}>
              Horarios: {m.scheduleTimes.join(", ")}
            </Text>
          )}
          {m.notes && <Text style={styles.cardMeta}>Notas: {m.notes}</Text>}
          <Text style={styles.cardMeta}>
            Tomas registradas hoy: {logsCountFor(m.id)}
          </Text>
          <View style={styles.cardActions}>
            <Pressable style={styles.logButton} onPress={() => onLogDose(m)}>
              <Text style={styles.logButtonText}>Registrar toma</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => onDelete(m)}>
              <Text style={styles.deleteButtonText}>Eliminar</Text>
            </Pressable>
          </View>

          {loggingMedication?.id === m.id && (
            <View style={styles.logForm}>
              <Text style={styles.label}>Dosis (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 10"
                keyboardType="decimal-pad"
                value={logDoseAmount}
                onChangeText={setLogDoseAmount}
              />

              <Text style={styles.label}>Día y hora de la toma</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.input, styles.flex1]}
                  onPress={() => setLogPickerMode("date")}
                >
                  <Text style={styles.pickerText}>{formatDate(logDateTime)}</Text>
                </Pressable>
                <Pressable
                  style={[styles.input, styles.flex1, styles.marginLeft]}
                  onPress={() => setLogPickerMode("time")}
                >
                  <Text style={styles.pickerText}>{formatTime(logDateTime)}</Text>
                </Pressable>
              </View>

              {logPickerMode && (
                <View style={styles.pickerBox}>
                  <DateTimePicker
                    value={logDateTime}
                    mode={logPickerMode}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={onLogPickerChange}
                  />
                  {Platform.OS === "ios" && (
                    <Pressable
                      style={styles.doneButton}
                      onPress={() => setLogPickerMode(null)}
                    >
                      <Text style={styles.doneButtonText}>Listo</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.formActions}>
                <Pressable style={styles.cancelButton} onPress={onCancelLog}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, loggingSaving && styles.disabled]}
                  onPress={onConfirmLog}
                  disabled={loggingSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {loggingSaving ? "Guardando..." : "Confirmar toma"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ))}

      {!showAddForm && (
        <Pressable
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
        >
          <Text style={styles.addButtonText}>+ Agregar medicamento</Text>
        </Pressable>
      )}

      {showAddForm && (
        <View style={styles.formBox}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Lantus, Humalog, Metformina"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setShowNameSuggestions(true);
              setEvidenceResults(null);
            }}
          />
          {nameSuggestions.length > 0 && (
            <View style={styles.suggestionBox}>
              {nameSuggestions.map((s) => (
                <Pressable
                  key={s.slug}
                  style={styles.suggestionRow}
                  onPress={() => onSelectSuggestion(s.slug)}
                >
                  <Text style={styles.suggestionText}>{s.names[0]}</Text>
                  <Text style={styles.suggestionMeta}>{MEDICATION_TYPE_LABELS[s.type]}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {matchedReference && (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceTitle}>
                Ficha de referencia — {matchedReference.names[0]}
              </Text>
              <Text style={styles.referenceText}>{matchedReference.description}</Text>
              {matchedReference.onset && (
                <Text style={styles.referenceMeta}>Inicio de acción: {matchedReference.onset}</Text>
              )}
              {matchedReference.peak && (
                <Text style={styles.referenceMeta}>Pico: {matchedReference.peak}</Text>
              )}
              {matchedReference.duration && (
                <Text style={styles.referenceMeta}>Duración: {matchedReference.duration}</Text>
              )}
              <Text style={styles.referenceMeta}>Precauciones: {matchedReference.precautions}</Text>
              <Text style={styles.referenceSource}>Fuente: {matchedReference.source}</Text>
              <Text style={styles.referenceDisclaimer}>
                Información general de referencia — no reemplaza la indicación de tu equipo médico.
              </Text>

              <Pressable
                style={[styles.evidenceButton, evidenceLoading && styles.disabled]}
                onPress={onSearchEvidence}
                disabled={evidenceLoading}
              >
                <Text style={styles.evidenceButtonText}>
                  {evidenceLoading ? "Buscando..." : "Buscar evidencia relacionada"}
                </Text>
              </Pressable>

              {evidenceResults && evidenceResults.length === 0 && (
                <Text style={styles.referenceMeta}>Sin resultados de evidencia.</Text>
              )}
              {evidenceResults?.map((r) => (
                <View key={`${r.id}-${r.rowId}`} style={styles.evidenceCard}>
                  <Text style={styles.evidenceTitle}>
                    {r.title} {r.curated ? "" : "· 🔴 no revisado (PubMed en vivo)"}
                  </Text>
                  <Text style={styles.evidenceMeta}>
                    {r.authors} ({r.year || "s/f"}) · {r.source}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.chipGrid}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.chip, type === opt && styles.chipSelected]}
                onPress={() => setType(opt)}
              >
                <Text
                  style={[
                    styles.chipText,
                    type === opt && styles.chipTextSelected,
                  ]}
                >
                  {MEDICATION_TYPE_LABELS[opt]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Dosis</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 10"
                keyboardType="decimal-pad"
                value={doseAmount}
                onChangeText={setDoseAmount}
              />
            </View>
            <View style={[styles.flex1, styles.marginLeft]}>
              <Text style={styles.label}>Unidad</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. unidades, mg"
                value={doseUnit}
                onChangeText={setDoseUnit}
              />
            </View>
          </View>

          <Text style={styles.label}>Horarios de toma</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex1]}
              placeholder="HH:MM, ej. 08:00"
              value={timeInput}
              onChangeText={setTimeInput}
            />
            <Pressable style={styles.smallAddButton} onPress={addTime}>
              <Text style={styles.smallAddButtonText}>Agregar</Text>
            </Pressable>
          </View>
          {scheduleTimes.length > 0 && (
            <View style={styles.chipGrid}>
              {scheduleTimes.map((t) => (
                <Pressable
                  key={t}
                  style={styles.timeChip}
                  onPress={() => removeTime(t)}
                >
                  <Text style={styles.timeChipText}>{t} ✕</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Ej. tomar con alimentos, ajustar si hay ejercicio..."
            value={notes}
            onChangeText={setNotes}
            multiline
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
              onPress={onSaveMedication}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Guardando..." : "Guardar"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.disclaimer}>
        Los horarios y dosis registrados son para tu control personal. Cualquier
        ajuste de tratamiento debe ser indicado por tu médico.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12, color: "#111827" },
  emptyText: { color: "#6b7280", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardType: { fontSize: 11, color: "#2563eb", fontWeight: "600" },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  logButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  deleteButtonText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  logForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  pickerText: { fontSize: 15, color: "#111827", textAlign: "center" },
  pickerBox: {
    backgroundColor: "#f9fafb",
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
  interactionCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  interactionText: { fontSize: 12, color: "#92400e", lineHeight: 17 },
  suggestionBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 4,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  suggestionText: { fontSize: 14, color: "#111827", fontWeight: "600" },
  suggestionMeta: { fontSize: 11, color: "#2563eb" },
  referenceCard: {
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  referenceTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  referenceText: { fontSize: 12, color: "#374151", lineHeight: 17, marginBottom: 6 },
  referenceMeta: { fontSize: 11, color: "#4338ca", marginTop: 2 },
  referenceSource: { fontSize: 10, color: "#6b7280", marginTop: 6, fontStyle: "italic" },
  referenceDisclaimer: {
    fontSize: 10,
    color: "#92400e",
    marginTop: 6,
    fontStyle: "italic",
  },
  evidenceButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  evidenceButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  evidenceCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  evidenceTitle: { fontSize: 12, fontWeight: "700", color: "#111827" },
  evidenceMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
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
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  notesInput: { minHeight: 70, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  flex1: { flex: 1 },
  marginLeft: { marginLeft: 8 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextSelected: { color: "#fff" },
  timeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#eef2ff",
  },
  timeChipText: { fontSize: 12, color: "#4338ca", fontWeight: "600" },
  smallAddButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  smallAddButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
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
  saveButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
    fontStyle: "italic",
  },
});
