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
  clearStoredCredentials as clearLibreLinkUpCredentials,
  getStoredCredentials as getLibreLinkUpCredentials,
  setStoredCredentials as setLibreLinkUpCredentials,
  syncLibreLinkUp,
} from "../lib/librelinkup";
import {
  clearStoredCredentials as clearUltrahumanCredentials,
  getStoredCredentials as getUltrahumanCredentials,
  setStoredCredentials as setUltrahumanCredentials,
  syncUltrahuman,
} from "../lib/ultrahuman";
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

function LibreLinkUpSection() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    getLibreLinkUpCredentials().then((creds) => setHasStoredCreds(!!creds));
  }, []);

  const onSaveCredentials = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Faltan datos", "Ingresa tu usuario y contraseña de LibreLinkUp.");
      return;
    }
    await setLibreLinkUpCredentials(email, password);
    setHasStoredCreds(true);
    setEmail("");
    setPassword("");
    Alert.alert("Guardado", "Tus credenciales de LibreLinkUp se guardaron cifradas en este dispositivo.");
  };

  const onClearCredentials = () => {
    Alert.alert("Eliminar credenciales", "¿Seguro que quieres eliminarlas?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await clearLibreLinkUpCredentials();
          setHasStoredCreds(false);
          setLastResult(null);
        },
      },
    ]);
  };

  const onSync = async () => {
    setSyncing(true);
    setLastResult(null);
    try {
      const result = await syncLibreLinkUp();
      setLastResult(
        `${result.patientName}: ${result.importedCount} lecturas nuevas importadas (de ${result.fetchedCount} recibidas).`
      );
    } catch (e: any) {
      Alert.alert("Error al sincronizar", e?.message ?? "No se pudo sincronizar con LibreLinkUp.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>LibreLinkUp — sincronización automática (opcional)</Text>
      <Text style={styles.description}>
        Usa la API no oficial de LibreLinkUp (la misma que apps como Nightscout llevan años
        usando) para traer tus lecturas automáticamente, sin capturas de pantalla. No es una
        API soportada por Abbott: podría cambiar o dejar de funcionar sin aviso. Configura tu
        cuenta de LibreLinkUp como "seguidor" de tu propio sensor antes de usar esto. No usa
        créditos de Anthropic ni de Voyage.
      </Text>
      <Text style={styles.status}>
        Credenciales: {hasStoredCreds ? "✅ Guardadas" : "⚠️ No configuradas"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email de LibreLinkUp"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña de LibreLinkUp"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Pressable style={styles.saveButton} onPress={onSaveCredentials}>
        <Text style={styles.saveButtonText}>Guardar credenciales</Text>
      </Pressable>

      {hasStoredCreds && (
        <>
          <Pressable
            style={[styles.synthesizeButton, syncing && styles.disabled]}
            onPress={onSync}
            disabled={syncing}
          >
            <Text style={styles.saveButtonText}>
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Text>
          </Pressable>
          {lastResult && <Text style={styles.status}>{lastResult}</Text>}
          <Pressable style={styles.clearButton} onPress={onClearCredentials}>
            <Text style={styles.clearButtonText}>Eliminar credenciales guardadas</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function UltrahumanSection() {
  const [token, setToken] = useState("");
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    getUltrahumanCredentials().then((creds) => setHasStoredCreds(!!creds));
  }, []);

  const onSaveCredentials = async () => {
    if (!token.trim()) {
      Alert.alert("Falta el token", "Ingresa tu Personal API Token de Ultrahuman.");
      return;
    }
    await setUltrahumanCredentials(token);
    setHasStoredCreds(true);
    setToken("");
    Alert.alert("Guardado", "Tu token de Ultrahuman se guardó cifrado en este dispositivo.");
  };

  const onClearCredentials = () => {
    Alert.alert("Eliminar credenciales", "¿Seguro que quieres eliminarlas?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await clearUltrahumanCredentials();
          setHasStoredCreds(false);
          setLastResult(null);
        },
      },
    ]);
  };

  const onSync = async () => {
    setSyncing(true);
    setLastResult(null);
    try {
      const result = await syncUltrahuman(7);
      const errorsSuffix = result.errors.length
        ? ` Errores: ${result.errors.join(" | ")}`
        : "";
      setLastResult(
        `${result.daysImported} de ${result.daysAttempted} días importados.${errorsSuffix}`
      );
    } catch (e: any) {
      Alert.alert("Error al sincronizar", e?.message ?? "No se pudo sincronizar con Ultrahuman.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ultrahuman — sueño, HRV y recuperación (opcional)</Text>
      <Text style={styles.description}>
        Usa el Personal API Token que generás en vision.ultrahuman.com/developer (iniciando
        sesión con tu cuenta Ultrahuman) para traer tus datos de sueño, HRV, frecuencia cardíaca
        en reposo y recuperación. No mandes tu email de cuenta acá — el token ya está atado a tu
        cuenta y agregar el email hace que la API lo trate como acceso a otra cuenta, que
        rechazaría con error 401. No usa créditos de Anthropic ni de Voyage.
      </Text>
      <Text style={styles.status}>
        Token: {hasStoredCreds ? "✅ Guardado" : "⚠️ No configurado"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Personal API Token de Ultrahuman"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Pressable style={styles.saveButton} onPress={onSaveCredentials}>
        <Text style={styles.saveButtonText}>Guardar credenciales</Text>
      </Pressable>

      {hasStoredCreds && (
        <>
          <Pressable
            style={[styles.synthesizeButton, syncing && styles.disabled]}
            onPress={onSync}
            disabled={syncing}
          >
            <Text style={styles.saveButtonText}>
              {syncing ? "Sincronizando..." : "Sincronizar últimos 7 días"}
            </Text>
          </Pressable>
          {lastResult && <Text style={styles.status}>{lastResult}</Text>}
          <Pressable style={styles.clearButton} onPress={onClearCredentials}>
            <Text style={styles.clearButtonText}>Eliminar credenciales guardadas</Text>
          </Pressable>
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

      <LibreLinkUpSection />

      <UltrahumanSection />

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
