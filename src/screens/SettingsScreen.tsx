import React, { useEffect, useState } from "react";
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
import { synthesizeEvidence } from "../lib/geminiVision";
import type { EvidenceSynthesis } from "../lib/geminiVision";
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  setGeminiApiKey,
} from "../lib/gemini";
import {
  getCorpusSize,
  getIngestedCount,
  ingestCorpus,
  searchKnowledge,
} from "../lib/knowledgeBase";
import type { IngestProgress } from "../lib/knowledgeBase";
import type { DiabetesType, Hba1cReading, KnowledgeSearchResult } from "../types";
import { TARGET_RANGE } from "../types";
import {
  deleteAllKnowledgeChunks,
  getHba1cReadingsSince,
  getPatientProfile,
  insertHba1cReading,
  upsertPatientProfile,
} from "../db/database";
import {
  clearSyncCredentials,
  getRecentSyncRuns,
  getSyncStatus,
  saveLibreLinkUpCredentials,
  saveUltrahumanCredentials,
  triggerSyncNow,
} from "../lib/syncCredentials";
import type { SyncRun } from "../lib/syncCredentials";
import { clearOcrApiKey, getOcrApiKey, setOcrApiKey } from "../lib/ocrSpace";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/dateTimeUtils";

interface ApiKeySectionProps {
  title: string;
  description: string;
  placeholder: string;
  expectedPrefix: string;
  getKey: () => Promise<string | null>;
  saveKey: (key: string) => Promise<void>;
  clearKey: () => Promise<void>;
}

function ApiKeySection({
  title,
  description,
  placeholder,
  expectedPrefix,
  getKey,
  saveKey,
  clearKey,
}: ApiKeySectionProps) {
  const [key, setKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    getKey().then((existing) => setHasStoredKey(!!existing));
  }, [getKey]);

  const doSave = async () => {
    await saveKey(key);
    setHasStoredKey(true);
    setKey("");
    Alert.alert("Guardado", "Tu API key se guardó de forma segura en este dispositivo.");
  };

  const onSave = async () => {
    if (!key.trim()) return;
    if (!key.trim().startsWith(expectedPrefix)) {
      Alert.alert(
        "Verifica tu API key",
        `Las API keys de este proveedor normalmente empiezan con '${expectedPrefix}'. ¿Quieres guardarla de todas formas?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar de todas formas", onPress: doSave },
        ]
      );
      return;
    }
    await doSave();
  };

  const onClear = () => {
    Alert.alert("Eliminar API key", "¿Seguro que quieres eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await clearKey();
          setHasStoredKey(false);
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.status}>
        Estado: {hasStoredKey ? "✅ Configurada" : "⚠️ No configurada"}
      </Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
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
    </View>
  );
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lastRunLabel(run: SyncRun | undefined): string | null {
  if (!run) return null;
  const when = formatDateTime(run.ranAtMs);
  if (run.status === "error") return `Último intento automático: ${when} — error: ${run.message}`;
  return `Última sincronización automática: ${when} — ${run.importedCount} nuevos registros.`;
}

function AutoSyncSection() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getSyncStatus>> | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [libreEmail, setLibreEmail] = useState("");
  const [librePassword, setLibrePassword] = useState("");
  const [uhToken, setUhToken] = useState("");
  const [syncingNow, setSyncingNow] = useState(false);
  const [nowResult, setNowResult] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [s, r] = await Promise.all([getSyncStatus(), getRecentSyncRuns(10)]);
      setStatus(s);
      setRuns(r);
    } catch {
      // Tablas de sync todavía no migradas en Supabase (ver supabase/schema.sql) — se
      // resuelve solo una vez corrida la migración, no hace falta molestar al usuario acá.
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSaveLibre = async () => {
    if (!libreEmail.trim() || !librePassword) {
      Alert.alert("Faltan datos", "Ingresa tu usuario y contraseña de LibreLinkUp.");
      return;
    }
    try {
      await saveLibreLinkUpCredentials(libreEmail, librePassword);
      setLibreEmail("");
      setLibrePassword("");
      await refresh();
      Alert.alert(
        "Guardado",
        "Tus credenciales de LibreLinkUp quedaron guardadas en el servidor para la sincronización automática cada hora."
      );
    } catch (e: any) {
      Alert.alert("Error al guardar", e?.message ?? "No se pudo guardar. Revisa que la migración de Supabase esté aplicada.");
    }
  };

  const onSaveUltrahuman = async () => {
    if (!uhToken.trim()) {
      Alert.alert("Falta el token", "Ingresa tu Personal API Token de Ultrahuman.");
      return;
    }
    try {
      await saveUltrahumanCredentials(uhToken);
      setUhToken("");
      await refresh();
      Alert.alert(
        "Guardado",
        "Tu token de Ultrahuman quedó guardado en el servidor para la sincronización automática cada hora."
      );
    } catch (e: any) {
      Alert.alert("Error al guardar", e?.message ?? "No se pudo guardar. Revisa que la migración de Supabase esté aplicada.");
    }
  };

  const onClear = (service: "librelinkup" | "ultrahuman", label: string) => {
    Alert.alert(`Eliminar credenciales de ${label}`, "¿Seguro que quieres eliminarlas?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await clearSyncCredentials(service);
          await refresh();
        },
      },
    ]);
  };

  const onSyncNow = async () => {
    setSyncingNow(true);
    setNowResult(null);
    try {
      const result = await triggerSyncNow();
      const parts = result.results.map((r) =>
        r.error ? `${r.service}: error — ${r.error}` : `${r.service}: ${r.importedCount ?? 0} nuevos`
      );
      setNowResult(parts.join(" · ") || "No hay credenciales configuradas.");
      await refresh();
    } catch (e: any) {
      Alert.alert("Error al sincronizar", e?.message ?? "No se pudo invocar la sincronización.");
    } finally {
      setSyncingNow(false);
    }
  };

  const hasLibre = !!status?.librelinkup;
  const hasUh = !!status?.ultrahuman;
  const lastLibreRun = runs.find((r) => r.service === "librelinkup");
  const lastUhRun = runs.find((r) => r.service === "ultrahuman");

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sincronización automática — LibreLinkUp y Ultrahuman</Text>
      <Text style={styles.description}>
        Las credenciales que guardes acá quedan en el servidor (Supabase), no solo en este
        celular: un job corre cada hora y trae tus lecturas de LibreLinkUp y tus métricas de
        Ultrahuman automáticamente, aunque la app esté cerrada. Quedan protegidas por Supabase
        (cifrado en reposo + acceso restringido a tu propia cuenta) — nadie más que vos puede
        verlas, aunque no es cifrado de extremo a extremo.
      </Text>

      <Text style={styles.subsectionTitle}>LibreLinkUp</Text>
      <Text style={styles.status}>
        Credenciales: {hasLibre ? "✅ Guardadas en el servidor" : "⚠️ No configuradas"}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Email de LibreLinkUp"
        value={libreEmail}
        onChangeText={setLibreEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña de LibreLinkUp"
        value={librePassword}
        onChangeText={setLibrePassword}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Pressable style={styles.saveButton} onPress={onSaveLibre}>
        <Text style={styles.saveButtonText}>Guardar credenciales</Text>
      </Pressable>
      {hasLibre && (
        <>
          {lastRunLabel(lastLibreRun) && (
            <Text style={styles.status}>{lastRunLabel(lastLibreRun)}</Text>
          )}
          <Pressable style={styles.clearButton} onPress={() => onClear("librelinkup", "LibreLinkUp")}>
            <Text style={styles.clearButtonText}>Eliminar credenciales guardadas</Text>
          </Pressable>
        </>
      )}

      <Text style={[styles.subsectionTitle, { marginTop: 18 }]}>Ultrahuman</Text>
      <Text style={styles.status}>
        Token: {hasUh ? "✅ Guardado en el servidor" : "⚠️ No configurado"}
      </Text>
      <Text style={styles.description}>
        Usa el Personal API Token que generás en vision.ultrahuman.com/developer. No mandes tu
        email de cuenta acá — el token ya está atado a tu cuenta.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Personal API Token de Ultrahuman"
        value={uhToken}
        onChangeText={setUhToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Pressable style={styles.saveButton} onPress={onSaveUltrahuman}>
        <Text style={styles.saveButtonText}>Guardar credenciales</Text>
      </Pressable>
      {hasUh && (
        <>
          {lastRunLabel(lastUhRun) && <Text style={styles.status}>{lastRunLabel(lastUhRun)}</Text>}
          <Pressable style={styles.clearButton} onPress={() => onClear("ultrahuman", "Ultrahuman")}>
            <Text style={styles.clearButtonText}>Eliminar credenciales guardadas</Text>
          </Pressable>
        </>
      )}

      {(hasLibre || hasUh) && (
        <>
          <Pressable
            style={[styles.synthesizeButton, syncingNow && styles.disabled, { marginTop: 18 }]}
            onPress={onSyncNow}
            disabled={syncingNow}
          >
            <Text style={styles.saveButtonText}>
              {syncingNow ? "Sincronizando..." : "Sincronizar ahora"}
            </Text>
          </Pressable>
          {nowResult && <Text style={styles.status}>{nowResult}</Text>}
        </>
      )}
    </View>
  );
}

const DIABETES_TYPE_OPTIONS: { key: DiabetesType; label: string }[] = [
  { key: "type1", label: "Tipo 1" },
  { key: "type2", label: "Tipo 2" },
  { key: "gestational", label: "Gestacional" },
  { key: "other", label: "Otro" },
];

function PatientProfileSection() {
  const [diabetesType, setDiabetesType] = useState<DiabetesType>("type1");
  const [targetLow, setTargetLow] = useState(String(TARGET_RANGE.low));
  const [targetHigh, setTargetHigh] = useState(String(TARGET_RANGE.high));
  const [insulinCarbRatio, setInsulinCarbRatio] = useState("");
  const [insulinSensitivityFactor, setInsulinSensitivityFactor] = useState("");
  const [diagnosisYear, setDiagnosisYear] = useState("");
  const [utcOffsetHours, setUtcOffsetHours] = useState("-6");
  const [saving, setSaving] = useState(false);

  const [hba1cValue, setHba1cValue] = useState("");
  const [hba1cDate, setHba1cDate] = useState(() => new Date());
  const [hba1cPickerOpen, setHba1cPickerOpen] = useState(false);
  const [hba1cReadings, setHba1cReadings] = useState<Hba1cReading[]>([]);
  const [savingHba1c, setSavingHba1c] = useState(false);

  const refresh = async () => {
    try {
      const profile = await getPatientProfile();
      if (profile) {
        setDiabetesType(profile.diabetesType);
        setTargetLow(String(profile.targetRangeLow));
        setTargetHigh(String(profile.targetRangeHigh));
        setInsulinCarbRatio(profile.insulinCarbRatio != null ? String(profile.insulinCarbRatio) : "");
        setInsulinSensitivityFactor(
          profile.insulinSensitivityFactor != null ? String(profile.insulinSensitivityFactor) : ""
        );
        setDiagnosisYear(profile.diagnosisYear != null ? String(profile.diagnosisYear) : "");
        setUtcOffsetHours(String(profile.utcOffsetHours));
      }
      const readings = await getHba1cReadingsSince(0);
      setHba1cReadings(readings.slice(0, 3));
    } catch {
      // Tablas de perfil todavía no migradas en Supabase (ver
      // supabase/migration_patient_profile.sql) — se resuelve solo una vez
      // corrida la migración, no hace falta molestar al usuario acá.
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSaveProfile = async () => {
    const low = Number(targetLow.replace(",", "."));
    const high = Number(targetHigh.replace(",", "."));
    if (!targetLow || !targetHigh || Number.isNaN(low) || Number.isNaN(high) || low >= high) {
      Alert.alert("Rango inválido", "El límite bajo debe ser menor al límite alto, ambos numéricos.");
      return;
    }
    const ratio = insulinCarbRatio.trim() ? Number(insulinCarbRatio.replace(",", ".")) : null;
    if (ratio !== null && (Number.isNaN(ratio) || ratio <= 0)) {
      Alert.alert("Ratio inválido", "El ratio insulina:carbohidratos debe ser un número mayor a 0.");
      return;
    }
    const sensitivity = insulinSensitivityFactor.trim()
      ? Number(insulinSensitivityFactor.replace(",", "."))
      : null;
    if (sensitivity !== null && (Number.isNaN(sensitivity) || sensitivity <= 0)) {
      Alert.alert("Factor inválido", "El factor de sensibilidad debe ser un número mayor a 0.");
      return;
    }
    const year = diagnosisYear.trim() ? Number(diagnosisYear) : null;
    if (year !== null && (Number.isNaN(year) || year < 1900 || year > new Date().getFullYear())) {
      Alert.alert("Año inválido", "Ingresa un año de diagnóstico válido.");
      return;
    }
    const offset = Number(utcOffsetHours.replace(",", "."));
    if (!utcOffsetHours || Number.isNaN(offset)) {
      Alert.alert("Zona horaria inválida", "El offset de zona horaria debe ser numérico.");
      return;
    }

    setSaving(true);
    try {
      await upsertPatientProfile({
        diabetesType,
        targetRangeLow: low,
        targetRangeHigh: high,
        insulinCarbRatio: ratio,
        insulinSensitivityFactor: sensitivity,
        diagnosisYear: year,
        utcOffsetHours: offset,
      });
      await refresh();
      Alert.alert("Guardado", "Tu perfil se guardó correctamente.");
    } catch (e: any) {
      Alert.alert(
        "Error al guardar",
        e?.message ?? "No se pudo guardar. Revisa que la migración de Supabase esté aplicada."
      );
    } finally {
      setSaving(false);
    }
  };

  const onHba1cDateChange = (event: { type: string }, selected?: Date) => {
    if (Platform.OS === "android") setHba1cPickerOpen(false);
    if (event.type === "dismissed" || !selected) return;
    setHba1cDate(selected);
  };

  const onSaveHba1c = async () => {
    const numeric = Number(hba1cValue.replace(",", "."));
    if (!hba1cValue || Number.isNaN(numeric) || numeric <= 0) {
      Alert.alert("Valor inválido", "Ingresa un valor de HbA1c válido (%).");
      return;
    }
    if (hba1cDate.getTime() > Date.now()) {
      Alert.alert("Fecha inválida", "No puedes registrar una medición en el futuro.");
      return;
    }
    setSavingHba1c(true);
    try {
      await insertHba1cReading({
        valuePct: numeric,
        measuredAtMs: hba1cDate.getTime(),
        notes: null,
      });
      setHba1cValue("");
      setHba1cDate(new Date());
      await refresh();
      Alert.alert("Guardado", "La medición de HbA1c se registró correctamente.");
    } catch (e: any) {
      Alert.alert(
        "Error al guardar",
        e?.message ?? "No se pudo guardar. Revisa que la migración de Supabase esté aplicada."
      );
    } finally {
      setSavingHba1c(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Perfil de paciente</Text>
      <Text style={styles.description}>
        Este perfil alimenta el rango objetivo, la detección de patrones y el cálculo de dosis
        del resto de la app. Guárdalo una vez y no tendrás que repetirlo.
      </Text>

      <Text style={styles.subsectionTitle}>Tipo de diabetes</Text>
      <View style={styles.trendGrid}>
        {DIABETES_TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.trendChip, diabetesType === opt.key && styles.trendChipSelected]}
            onPress={() => setDiabetesType(opt.key)}
          >
            <Text
              style={[
                styles.trendChipText,
                diabetesType === opt.key && styles.trendChipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subsectionTitle}>Rango objetivo (mg/dL)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="Bajo (ej. 70)"
          keyboardType="decimal-pad"
          value={targetLow}
          onChangeText={setTargetLow}
        />
        <TextInput
          style={[styles.input, styles.flex1, styles.marginLeft]}
          placeholder="Alto (ej. 180)"
          keyboardType="decimal-pad"
          value={targetHigh}
          onChangeText={setTargetHigh}
        />
      </View>

      <Text style={styles.subsectionTitle}>Ratio insulina:carbohidratos (g por unidad)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 10 (1 unidad cubre 10g de carbohidratos)"
        keyboardType="decimal-pad"
        value={insulinCarbRatio}
        onChangeText={setInsulinCarbRatio}
      />

      <Text style={styles.subsectionTitle}>Factor de sensibilidad a la insulina (mg/dL por unidad)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 50 (1 unidad de corrección baja 50 mg/dL)"
        keyboardType="decimal-pad"
        value={insulinSensitivityFactor}
        onChangeText={setInsulinSensitivityFactor}
      />

      <Text style={styles.subsectionTitle}>Año de diagnóstico</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 2015"
        keyboardType="number-pad"
        value={diagnosisYear}
        onChangeText={setDiagnosisYear}
      />

      <Text style={styles.subsectionTitle}>Offset de zona horaria (horas respecto a UTC)</Text>
      <Text style={styles.description}>
        Hoy la sincronización automática de Ultrahuman solo interpreta correctamente este valor
        para la hora de México (CST, sin horario de verano desde 2022): -6. Cambiarlo afecta a
        qué día calendario se le asignan tus métricas de sueño/HRV.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. -6"
        keyboardType="numbers-and-punctuation"
        value={utcOffsetHours}
        onChangeText={setUtcOffsetHours}
      />

      <Pressable
        style={[styles.saveButton, saving && styles.disabled, { marginTop: 8 }]}
        onPress={onSaveProfile}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? "Guardando..." : "Guardar perfil"}</Text>
      </Pressable>

      <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>Registrar HbA1c</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="Valor (%, ej. 7.2)"
          keyboardType="decimal-pad"
          value={hba1cValue}
          onChangeText={setHba1cValue}
        />
        <Pressable
          style={[styles.input, styles.flex1, styles.marginLeft]}
          onPress={() => setHba1cPickerOpen(true)}
        >
          <Text style={styles.pickerText}>{formatDate(hba1cDate)}</Text>
        </Pressable>
      </View>

      {hba1cPickerOpen && (
        <View style={styles.pickerBox}>
          <DateTimePicker
            value={hba1cDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={onHba1cDateChange}
          />
          {Platform.OS === "ios" && (
            <Pressable style={styles.doneButton} onPress={() => setHba1cPickerOpen(false)}>
              <Text style={styles.doneButtonText}>Listo</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        style={[styles.saveButton, savingHba1c && styles.disabled, { marginTop: 8 }]}
        onPress={onSaveHba1c}
        disabled={savingHba1c}
      >
        <Text style={styles.saveButtonText}>
          {savingHba1c ? "Guardando..." : "Registrar HbA1c"}
        </Text>
      </Pressable>

      {hba1cReadings.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.subsectionTitle}>Últimas mediciones</Text>
          {hba1cReadings.map((r) => (
            <Text key={r.id} style={styles.status}>
              {r.valuePct.toFixed(1)}% — {formatDate(new Date(r.measuredAtMs))}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function KnowledgeBaseSection() {
  const [ingestedCount, setIngestedCount] = useState(0);
  const corpusSize = getCorpusSize();
  const [syncing, setSyncing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);

  const refreshCount = async () => {
    setIngestedCount(await getIngestedCount());
  };

  useEffect(() => {
    refreshCount();
  }, []);

  const onSync = async () => {
    setSyncing(true);
    setProgress(null);
    try {
      const added = await ingestCorpus((p) => setProgress(p));
      await refreshCount();
      Alert.alert(
        "Sincronizado",
        added > 0
          ? `Se agregaron ${added} fragmentos nuevos a la base de conocimiento.`
          : "La base de conocimiento ya estaba al día."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo sincronizar la base de conocimiento.");
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const doRebuild = async () => {
    setRebuilding(true);
    setProgress(null);
    try {
      await deleteAllKnowledgeChunks();
      await refreshCount();
      const added = await ingestCorpus((p) => setProgress(p));
      await refreshCount();
      Alert.alert(
        "Base reconstruida",
        `Se regeneraron ${added} fragmentos con los embeddings de Gemini.`
      );
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message ??
          "No se pudo reconstruir la base de conocimiento. Revisa tu API key de Gemini y tu conexión."
      );
    } finally {
      setRebuilding(false);
      setProgress(null);
    }
  };

  const onRebuild = () => {
    Alert.alert(
      "Reconstruir base de conocimiento",
      "Esto borra todos los fragmentos guardados y re-genera sus embeddings con Gemini. Es necesario tras cambiar de proveedor de IA porque los embeddings viejos (de otra dimensión) no son compatibles. Requiere tu API key de Gemini configurada y consume algunas llamadas del tier gratuito. No afecta tus datos de glucosa, comidas ni medicamentos.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Reconstruir", style: "destructive", onPress: doRebuild },
      ]
    );
  };

  const busy = syncing || rebuilding;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Base de conocimiento clínica</Text>
      <Text style={styles.description}>
        Fragmentos de guías (ADA, ISPAD, ATTD) y papers que la app usa para fundamentar
        sus sugerencias con evidencia real. Requiere la API key de Gemini configurada
        arriba (gratis) para generar los embeddings.
      </Text>
      <Text style={styles.status}>
        Estado: {ingestedCount} / {corpusSize} fragmentos sincronizados
      </Text>
      {progress && (
        <Text style={styles.status}>
          Procesando... {progress.done} / {progress.total}
        </Text>
      )}
      <Pressable
        style={[styles.saveButton, busy && styles.disabled]}
        onPress={onSync}
        disabled={busy}
      >
        <Text style={styles.saveButtonText}>
          {syncing ? "Sincronizando..." : "Sincronizar base de conocimiento"}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.clearButton, busy && styles.disabled]}
        onPress={onRebuild}
        disabled={busy}
      >
        <Text style={styles.clearButtonText}>
          {rebuilding ? "Reconstruyendo..." : "Reconstruir base de conocimiento"}
        </Text>
      </Pressable>
    </View>
  );
}

const EVIDENCE_STRENGTH_LABELS: Record<EvidenceSynthesis["evidenceStrength"], string> = {
  strong: "Sólida",
  moderate: "Moderada",
  limited: "Limitada",
};

function KnowledgeSearchTestSection() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<EvidenceSynthesis | null>(null);

  const onSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults(null);
    setSynthesis(null);
    try {
      const found = await searchKnowledge(query.trim(), { topK: 5 });
      setResults(found);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo buscar en la base de conocimiento.");
    } finally {
      setSearching(false);
    }
  };

  const onSynthesize = async () => {
    if (!results || results.length === 0) return;
    setSynthesizing(true);
    setSynthesis(null);
    try {
      const result = await synthesizeEvidence(query.trim(), results);
      setSynthesis(result);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo generar el resumen de evidencia.");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Probar búsqueda (corpus + PubMed en vivo)</Text>
      <Text style={styles.description}>
        Escribe un patrón o pregunta (ej. "glucosa alta después de hacer ejercicio en la
        noche") para ver qué evidencia encuentra la app. Si el corpus local no tiene un
        buen match, buscará en vivo en PubMed automáticamente.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. hipoglucemia nocturna después de ejercicio"
        value={query}
        onChangeText={setQuery}
      />
      <Pressable
        style={[styles.saveButton, searching && styles.disabled]}
        onPress={onSearch}
        disabled={searching}
      >
        <Text style={styles.saveButtonText}>
          {searching ? "Buscando..." : "Buscar"}
        </Text>
      </Pressable>

      {results && results.length === 0 && (
        <Text style={styles.description}>Sin resultados.</Text>
      )}
      {results?.map((r) => (
        <View key={`${r.id}-${r.rowId}`} style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            {r.title} {r.curated ? "" : "· 🔴 no revisado (PubMed en vivo)"}
          </Text>
          <Text style={styles.resultMeta}>
            {r.authors} ({r.year || "s/f"}) · {r.source} · similitud{" "}
            {r.score.toFixed(2)}
          </Text>
          <Text style={styles.resultSummary}>{r.summary}</Text>
        </View>
      ))}

      {results && results.length > 0 && (
        <Pressable
          style={[styles.synthesizeButton, synthesizing && styles.disabled]}
          onPress={onSynthesize}
          disabled={synthesizing}
        >
          <Text style={styles.saveButtonText}>
            {synthesizing ? "Revisando evidencia..." : "Generar resumen clínico"}
          </Text>
        </Pressable>
      )}

      {synthesis && (
        <View style={styles.synthesisBox}>
          <Text style={styles.synthesisStrength}>
            Solidez de la evidencia: {EVIDENCE_STRENGTH_LABELS[synthesis.evidenceStrength]}
          </Text>

          <Text style={styles.synthesisSectionTitle}>Etiología</Text>
          <Text style={styles.synthesisText}>{synthesis.etiology}</Text>

          <Text style={styles.synthesisSectionTitle}>Manejo (temas para tu médico)</Text>
          <Text style={styles.synthesisText}>{synthesis.management}</Text>

          <Text style={styles.synthesisSectionTitle}>Resultado probable</Text>
          <Text style={styles.synthesisText}>{synthesis.likelyOutcome}</Text>

          {synthesis.caveats && (
            <>
              <Text style={styles.synthesisSectionTitle}>Advertencias</Text>
              <Text style={styles.synthesisCaveats}>{synthesis.caveats}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function AccountSection() {
  const { session, signOut } = useAuth();

  const onSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Cuenta</Text>
      <Text style={styles.description}>Sesión iniciada como {session?.user.email}</Text>
      <Pressable style={styles.clearButton} onPress={onSignOut}>
        <Text style={styles.clearButtonText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ajustes</Text>

      <AccountSection />

      <AutoSyncSection />

      <PatientProfileSection />

      <ApiKeySection
        title="API key de OCR.space — lectura gratis de capturas de LibreLink"
        description="Se usa para autocompletar el valor de glucosa al importar una captura de LibreLink, sin gastar tu cuota de Gemini. Es gratis: regístrate sin tarjeta en ocr.space/ocrapi/freekey para obtener tu key. Solo lee el número — la flecha de tendencia hay que confirmarla a mano, a diferencia del autocompletado con IA."
        placeholder="Tu API key de OCR.space"
        expectedPrefix=""
        getKey={getOcrApiKey}
        saveKey={setOcrApiKey}
        clearKey={clearOcrApiKey}
      />

      <ApiKeySection
        title="API key de Google Gemini — opcional (gratis)"
        description="Una sola key para toda la IA de la app: autocompletado de capturas de LibreLink, análisis de fotos de comida, embeddings de la base de evidencia y resúmenes clínicos. Gemini tiene tier gratuito sin tarjeta: consíguela en aistudio.google.com/apikey. Todo el núcleo de la app (registro, sync, OCR.space, detección de patrones) funciona sin esta key. Se guarda cifrada en este dispositivo y nunca se comparte."
        placeholder="AIza..."
        expectedPrefix="AIza"
        getKey={getGeminiApiKey}
        saveKey={setGeminiApiKey}
        clearKey={clearGeminiApiKey}
      />

      <KnowledgeBaseSection />

      <KnowledgeSearchTestSection />

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
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 6 },
  subsectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 6 },
  description: { fontSize: 13, color: "#6b7280", marginBottom: 10, lineHeight: 18 },
  status: { fontSize: 13, color: "#374151", marginBottom: 10, fontWeight: "600" },
  input: {
    backgroundColor: "#f9fafb",
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
  row: { flexDirection: "row" },
  flex1: { flex: 1 },
  marginLeft: { marginLeft: 8 },
  pickerText: { fontSize: 15, color: "#111827", textAlign: "center" },
  pickerBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 12,
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
  trendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
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
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  clearButton: { alignItems: "center", padding: 12, marginTop: 8 },
  clearButtonText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  resultCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  resultMeta: { fontSize: 11, color: "#6b7280", marginBottom: 6 },
  resultSummary: { fontSize: 12, color: "#374151", lineHeight: 17 },
  synthesizeButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  synthesisBox: {
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  synthesisStrength: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338ca",
    marginBottom: 8,
  },
  synthesisSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  synthesisText: { fontSize: 13, color: "#374151", lineHeight: 18, marginTop: 2 },
  synthesisCaveats: {
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
    marginTop: 2,
    fontStyle: "italic",
  },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
    fontStyle: "italic",
    lineHeight: 16,
  },
});
