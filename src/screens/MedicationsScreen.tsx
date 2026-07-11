import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  deleteMedication,
  getActiveMedications,
  getMedicationLogsSince,
  insertMedication,
  insertMedicationLog,
  updateMedicationNotificationIds,
} from "../db/database";
import {
  cancelNotifications,
  scheduleMedicationReminders,
} from "../lib/notifications";
import type { Medication, MedicationLog, MedicationType } from "../types";
import { MEDICATION_TYPE_LABELS } from "../types";

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
  };

  const onSaveMedication = async () => {
    if (!name.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre del medicamento.");
      return;
    }
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
    Alert.alert(
      "Registrar toma",
      `¿Registrar toma de ${medication.name} ahora?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Registrar",
          onPress: async () => {
            await insertMedicationLog({
              medicationId: medication.id,
              takenAtMs: Date.now(),
              doseAmount: medication.doseAmount,
              notes: null,
            });
            load();
          },
        },
      ]
    );
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
              <Text style={styles.logButtonText}>Registrar toma ahora</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => onDelete(m)}>
              <Text style={styles.deleteButtonText}>Eliminar</Text>
            </Pressable>
          </View>
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
            onChangeText={setName}
          />

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
