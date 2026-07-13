import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import {
  computeStats,
  deleteReading,
  getActiveMedications,
  getMealsSince,
  getMedicationLogsSince,
  getReadingsSince,
} from "../db/database";
import { detectPatterns } from "../lib/patterns";
import { searchKnowledge } from "../lib/knowledgeBase";
import { synthesizeEvidence } from "../lib/anthropic";
import type { EvidenceSynthesis } from "../lib/anthropic";
import type {
  GlucoseReading,
  KnowledgeSearchResult,
  PatternFinding,
} from "../types";
import { TARGET_RANGE, TREND_LABELS } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PATTERN_WINDOW_MS = 14 * DAY_MS;

export default function HomeScreen() {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [patterns, setPatterns] = useState<PatternFinding[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const since = Date.now() - PATTERN_WINDOW_MS;
    const [rows, meals, medications, medicationLogs] = await Promise.all([
      getReadingsSince(since),
      getMealsSince(since),
      getActiveMedications(),
      getMedicationLogsSince(since),
    ]);
    setReadings(rows.filter((r) => r.timestampMs >= Date.now() - DAY_MS));
    setPatterns(detectPatterns(rows, meals, medications, medicationLogs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = (id: number) => {
    Alert.alert("Eliminar lectura", "¿Seguro que quieres eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteReading(id);
          load();
        },
      },
    ]);
  };

  const stats = computeStats(readings);
  const chronological = [...readings].reverse();
  const chartData =
    chronological.length > 0
      ? {
          labels: chronological.map((r) =>
            new Date(r.timestampMs).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })
          ),
          datasets: [{ data: chronological.map((r) => r.value) }],
        }
      : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Últimas 24 horas</Text>

      {chartData && chartData.labels.length > 1 ? (
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 32}
          height={220}
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
            propsForDots: { r: "3" },
          }}
          bezier
          style={styles.chart}
        />
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            Necesitas al menos 2 lecturas hoy para ver la gráfica.
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <StatCard label="Promedio" value={fmt(stats.average)} />
        <StatCard
          label="Tiempo en rango"
          value={stats.timeInRangePct != null ? `${stats.timeInRangePct.toFixed(0)}%` : "--"}
        />
        <StatCard label="Lecturas" value={String(stats.count)} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Mínimo" value={fmt(stats.min)} />
        <StatCard label="Máximo" value={fmt(stats.max)} />
        <StatCard label={`Bajas (<${TARGET_RANGE.low})`} value={String(stats.lowCount)} />
      </View>

      <Text style={styles.subtitle}>Patrones detectados (últimos 14 días)</Text>
      {patterns.length === 0 && (
        <Text style={styles.emptyText}>
          No se detectaron patrones con suficientes datos todavía. Entre más registres,
          mejor podrá la app encontrar patrones.
        </Text>
      )}
      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} />
      ))}

      <Text style={styles.subtitle}>Lecturas recientes</Text>
      {readings.length === 0 && (
        <Text style={styles.emptyText}>
          Aún no hay lecturas. Agrega una manualmente o importa una captura de LibreLink.
        </Text>
      )}
      {readings.map((r) => (
        <Pressable
          key={r.id}
          style={styles.readingRow}
          onLongPress={() => onDelete(r.id)}
        >
          <View>
            <Text style={styles.readingValue}>
              {r.value} {r.unit}
            </Text>
            <Text style={styles.readingMeta}>
              {new Date(r.timestampMs).toLocaleString("es-MX")} ·{" "}
              {r.source === "manual" ? "Manual" : "LibreLink"}
            </Text>
            {r.trend && (
              <Text style={styles.readingMeta}>{TREND_LABELS[r.trend]}</Text>
            )}
          </View>
        </Pressable>
      ))}
      <Text style={styles.hint}>Mantén presionada una lectura para eliminarla.</Text>
      <Text style={styles.disclaimer}>
        Esta app es una herramienta de apoyo y registro personal. No sustituye el
        criterio médico de tu equipo de endocrinología.
      </Text>
    </ScrollView>
  );
}

function fmt(n: number | null): string {
  return n == null ? "--" : n.toFixed(0);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const SEVERITY_LABELS: Record<PatternFinding["severity"], string> = {
  attention: "🔴 Atención",
  watch: "🟡 Vigilar",
  info: "🔵 Info",
};

const EVIDENCE_STRENGTH_LABELS: Record<EvidenceSynthesis["evidenceStrength"], string> = {
  strong: "Sólida",
  moderate: "Moderada",
  limited: "Limitada",
};

function PatternCard({ pattern }: { pattern: PatternFinding }) {
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [evidence, setEvidence] = useState<KnowledgeSearchResult[] | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<EvidenceSynthesis | null>(null);

  const onToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && evidence === null) {
      setSearching(true);
      try {
        const found = await searchKnowledge(pattern.suggestedQuery, { topK: 4 });
        setEvidence(found);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo buscar evidencia relacionada.");
      } finally {
        setSearching(false);
      }
    }
  };

  const onSynthesize = async () => {
    if (!evidence || evidence.length === 0) return;
    setSynthesizing(true);
    try {
      const result = await synthesizeEvidence(pattern.suggestedQuery, evidence);
      setSynthesis(result);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo generar el resumen clínico.");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <Pressable style={styles.patternCard} onPress={onToggle}>
      <View style={styles.patternHeader}>
        <Text style={styles.patternTitle}>{pattern.title}</Text>
        <Text style={styles.patternSeverity}>{SEVERITY_LABELS[pattern.severity]}</Text>
      </View>
      <Text style={styles.patternDescription}>{pattern.description}</Text>

      {expanded && (
        <View style={styles.patternEvidence}>
          {searching && <ActivityIndicator style={{ marginTop: 8 }} />}
          {evidence?.map((e) => (
            <View key={`${e.id}-${e.rowId}`} style={styles.evidenceCard}>
              <Text style={styles.evidenceTitle}>
                {e.title} {e.curated ? "" : "· 🔴 no revisado (PubMed en vivo)"}
              </Text>
              <Text style={styles.evidenceMeta}>
                {e.authors} ({e.year || "s/f"}) · {e.source}
              </Text>
            </View>
          ))}

          {evidence && evidence.length > 0 && !synthesis && (
            <Pressable
              style={[styles.synthesizeButton, synthesizing && styles.disabled]}
              onPress={onSynthesize}
              disabled={synthesizing}
            >
              <Text style={styles.synthesizeButtonText}>
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
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: "#111827" },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    color: "#111827",
  },
  chart: { borderRadius: 12, marginBottom: 8 },
  emptyChart: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
  },
  emptyText: { color: "#6b7280", textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
  readingRow: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  readingValue: { fontSize: 16, fontWeight: "600", color: "#111827" },
  readingMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  hint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    fontStyle: "italic",
  },
  patternCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  patternHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  patternTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  patternSeverity: { fontSize: 11, fontWeight: "600" },
  patternDescription: { fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 17 },
  patternEvidence: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 },
  evidenceCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  evidenceTitle: { fontSize: 12, fontWeight: "700", color: "#111827" },
  evidenceMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  synthesizeButton: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  synthesizeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  synthesisBox: {
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  synthesisStrength: { fontSize: 11, fontWeight: "700", color: "#4338ca", marginBottom: 6 },
  synthesisSectionTitle: { fontSize: 11, fontWeight: "700", color: "#111827", marginTop: 6 },
  synthesisText: { fontSize: 12, color: "#374151", lineHeight: 17, marginTop: 2 },
  synthesisCaveats: {
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
    marginTop: 2,
    fontStyle: "italic",
  },
});
