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
import {
  clearApiKey,
  getApiKey,
  setApiKey,
  synthesizeEvidence,
} from "../lib/anthropic";
import type { EvidenceSynthesis } from "../lib/anthropic";
import {
  clearVoyageApiKey,
  getVoyageApiKey,
  setVoyageApiKey,
} from "../lib/voyage";
import {
  getCorpusSize,
  getIngestedCount,
  ingestCorpus,
  searchKnowledge,
} from "../lib/knowledgeBase";
import type { IngestProgress } from "../lib/knowledgeBase";
import type { KnowledgeSearchResult } from "../types";
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

function KnowledgeBaseSection() {
  const [ingestedCount, setIngestedCount] = useState(0);
  const corpusSize = getCorpusSize();
  const [syncing, setSyncing] = useState(false);
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

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Base de conocimiento clínica</Text>
      <Text style={styles.description}>
        Fragmentos de guías (ADA, ISPAD, ATTD) y papers que la app usa para fundamentar
        sus sugerencias con evidencia real. Requiere la API key de Voyage AI configurada
        arriba.
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
        style={[styles.saveButton, syncing && styles.disabled]}
        onPress={onSync}
        disabled={syncing}
      >
        <Text style={styles.saveButtonText}>
          {syncing ? "Sincronizando..." : "Sincronizar base de conocimiento"}
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

      <ApiKeySection
        title="API key de OCR.space — lectura gratis de capturas de LibreLink"
        description="Se usa para autocompletar el valor de glucosa al importar una captura de LibreLink, sin usar créditos de Anthropic. Es gratis: regístrate sin tarjeta en ocr.space/ocrapi/freekey para obtener tu key. Solo lee el número — la flecha de tendencia hay que confirmarla a mano, a diferencia del autocompletado con IA."
        placeholder="Tu API key de OCR.space"
        expectedPrefix=""
        getKey={getOcrApiKey}
        saveKey={setOcrApiKey}
        clearKey={clearOcrApiKey}
      />

      <ApiKeySection
        title="API key de Anthropic (Claude) — opcional"
        description="Solo se usa para el autocompletado por IA de capturas de LibreLink, análisis de fotos de comida, y los resúmenes clínicos de evidencia. Todo lo demás de la app funciona sin esta key. Requiere crédito en tu cuenta de Anthropic. Se guarda cifrada en este dispositivo y nunca se comparte."
        placeholder="sk-ant-..."
        expectedPrefix="sk-ant-"
        getKey={getApiKey}
        saveKey={setApiKey}
        clearKey={clearApiKey}
      />

      <ApiKeySection
        title="API key de Voyage AI (embeddings)"
        description="Se usa para generar los embeddings de la base de evidencia clínica y así poder buscar los fragmentos más relevantes al dar recomendaciones. Distinta a la de Anthropic. Se guarda cifrada en este dispositivo."
        placeholder="pa-..."
        expectedPrefix="pa-"
        getKey={getVoyageApiKey}
        saveKey={setVoyageApiKey}
        clearKey={clearVoyageApiKey}
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
