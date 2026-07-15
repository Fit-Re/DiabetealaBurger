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
import GlucoseChart from "../components/GlucoseChart";
import {
  computeStats,
  deleteReading,
  getActiveMedications,
  getLifestyleMetricsSince,
  getMealsSince,
  getMedicationLogsSince,
  getReadingsBetween,
  getReadingsSince,
} from "../db/database";
import { addDays, isSameDay, startOfDay } from "../lib/dateTimeUtils";
import { detectPatterns } from "../lib/patterns";
import { searchKnowledge } from "../lib/knowledgeBase";
import { synthesizeEvidence } from "../lib/anthropic";
import type { EvidenceSynthesis } from "../lib/anthropic";
import type {
  GlucoseReading,
  KnowledgeSearchResult,
  LifestyleMetric,
  PatternFinding,
} from "../types";
import { TARGET_RANGE, TREND_LABELS } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PATTERN_WINDOW_MS = 14 * DAY_MS;

function dayLabel(day: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(day, today)) return "Hoy";
  if (isSameDay(day, addDays(today, -1))) return "Ayer";
  return day.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function HomeScreen() {
  const [dayStart, setDayStart] = useState(() => startOfDay(new Date()));
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [patterns, setPatterns] = useState<PatternFinding[]>([]);
  const [lifestyleMetrics, setLifestyleMetrics] = useState<LifestyleMetric[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = isSameDay(dayStart, startOfDay(new Date()));

  const load = useCallback(async () => {
    const since = Date.now() - PATTERN_WINDOW_MS;
    const [dayReadings, rows, meals, medications, medicationLogs, lifestyle] =
      await Promise.all([
        getReadingsBetween(dayStart.getTime(), dayStart.getTime() + DAY_MS),
        getReadingsSince(since),
        getMealsSince(since),
        getActiveMedications(),
        getMedicationLogsSince(since),
        getLifestyleMetricsSince(since),
      ]);
    setReadings(dayReadings);
    setLifestyleMetrics(lifestyle);
    setPatterns(detectPatterns(rows, meals, medications, medicationLogs, lifestyle));
  }, [dayStart]);

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

  const goToPreviousDay = () => setDayStart((d) => addDays(d, -1));
  const goToNextDay = () => setDayStart((d) => (isToday ? d : addDays(d, 1)));
  const goToToday = () => setDayStart(startOfDay(new Date()));

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
  const latest = chronological[chronological.length - 1] ?? null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.dayNavRow}>
        <Pressable
          style={styles.dayNavButton}
          onPress={goToPreviousDay}
          hitSlop={8}
        >
          <Text style={styles.dayNavArrow}>‹</Text>
        </Pressable>
        <Pressable onPress={goToToday} disabled={isToday} style={styles.dayNavLabelWrap}>
          <Text style={styles.title}>{dayLabel(dayStart)}</Text>
          {!isToday && <Text style={styles.dayNavToday}>Volver a hoy</Text>}
        </Pressable>
        <Pressable
          style={[styles.dayNavButton, isToday && styles.dayNavButtonDisabled]}
          onPress={goToNextDay}
          disabled={isToday}
          hitSlop={8}
        >
          <Text style={[styles.dayNavArrow, isToday && styles.dayNavArrowDisabled]}>›</Text>
        </Pressable>
      </View>

      {latest && <CurrentReadingCard reading={latest} isToday={isToday} />}

      {chronological.length > 1 ? (
        <View style={styles.chartCard}>
          <GlucoseChart
            readings={chronological}
            low={TARGET_RANGE.low}
            high={TARGET_RANGE.high}
            width={Dimensions.get("window").width - 32 - 24}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.legendRange]} />
              <Text style={styles.legendText}>Rango objetivo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineLow]} />
              <Text style={styles.legendText}>Bajo ({TARGET_RANGE.low})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineHigh]} />
              <Text style={styles.legendText}>Alto ({TARGET_RANGE.high})</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            Necesitas al menos 2 lecturas {isToday ? "hoy" : "ese día"} para ver la gráfica.
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

      {lifestyleMetrics.length > 0 && (
        <>
          <Text style={styles.subtitle}>Ultrahuman — último día sincronizado</Text>
          <LifestyleCard metric={lifestyleMetrics[0]} />
        </>
      )}

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

      <Text style={styles.subtitle}>
        {isToday ? "Lecturas de hoy" : `Lecturas — ${dayLabel(dayStart)}`}
      </Text>
      {readings.length === 0 && (
        <Text style={styles.emptyText}>
          {isToday
            ? "Aún no hay lecturas. Agrega una manualmente o importa una captura de LibreLink."
            : "No hay lecturas registradas ese día."}
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

function timeAgo(ms: number): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  return `hace ${diffHr} h`;
}

function CurrentReadingCard({
  reading,
  isToday,
}: {
  reading: GlucoseReading;
  isToday: boolean;
}) {
  const status =
    reading.value < TARGET_RANGE.low
      ? "low"
      : reading.value > TARGET_RANGE.high
      ? "high"
      : "inRange";
  const statusStyles = {
    inRange: { card: styles.readingCardInRange, bar: styles.readingBarInRange },
    low: { card: styles.readingCardLow, bar: styles.readingBarLow },
    high: { card: styles.readingCardHigh, bar: styles.readingBarHigh },
  }[status];

  return (
    <View style={[styles.readingCard, statusStyles.card]}>
      <View style={[styles.readingCardBar, statusStyles.bar]} />
      <View style={styles.readingCardContent}>
        <Text style={styles.readingCardLabel}>
          {isToday ? "Glucosa" : "Última lectura del día"}
        </Text>
        <View style={styles.readingCardValueRow}>
          <Text style={styles.readingCardValue}>{reading.value}</Text>
          <Text style={styles.readingCardUnit}>{reading.unit}</Text>
          {reading.trend && (
            <Text style={styles.readingCardTrend}>{TREND_LABELS[reading.trend].split(" ")[0]}</Text>
          )}
        </View>
        <Text style={styles.readingCardMeta}>
          {isToday
            ? timeAgo(reading.timestampMs)
            : new Date(reading.timestampMs).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
        </Text>
      </View>
    </View>
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

function fmtDuration(minutes: number | null): string {
  if (minutes == null) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function LifestyleCard({ metric }: { metric: LifestyleMetric }) {
  return (
    <View style={styles.lifestyleCard}>
      <Text style={styles.lifestyleDate}>
        {new Date(metric.dateMs).toLocaleDateString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </Text>
      <View style={styles.statsRow}>
        <StatCard label="Sueño" value={fmt(metric.sleepScore)} />
        <StatCard label="Duración" value={fmtDuration(metric.sleepDurationMin)} />
        <StatCard label="HRV" value={fmt(metric.hrvMs)} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="FC en reposo" value={fmt(metric.restingHeartRate)} />
        <StatCard label="Recuperación" value={fmt(metric.recoveryIndex)} />
        <StatCard label="Pasos" value={fmt(metric.steps)} />
      </View>
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
  dayNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayNavLabelWrap: { flex: 1, alignItems: "center" },
  dayNavToday: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
    marginTop: -6,
    marginBottom: 8,
  },
  dayNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  dayNavButtonDisabled: { opacity: 0.3 },
  dayNavArrow: { fontSize: 22, fontWeight: "700", color: "#111827" },
  dayNavArrowDisabled: { color: "#9ca3af" },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendRange: { backgroundColor: "#dcfce7" },
  legendLine: { width: 12, height: 0, borderTopWidth: 2, borderStyle: "dashed" },
  legendLineLow: { borderTopColor: "#dc2626" },
  legendLineHigh: { borderTopColor: "#d97706" },
  legendText: { fontSize: 10, color: "#6b7280" },
  readingCard: {
    flexDirection: "row",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  readingCardBar: { width: 6 },
  readingCardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  readingCardInRange: { backgroundColor: "#f0fdf4" },
  readingCardLow: { backgroundColor: "#fef2f2" },
  readingCardHigh: { backgroundColor: "#fffbeb" },
  readingBarInRange: { backgroundColor: "#16a34a" },
  readingBarLow: { backgroundColor: "#dc2626" },
  readingBarHigh: { backgroundColor: "#d97706" },
  readingCardLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  readingCardValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  readingCardValue: { fontSize: 34, fontWeight: "800", color: "#111827" },
  readingCardUnit: { fontSize: 13, color: "#6b7280" },
  readingCardTrend: { fontSize: 18, color: "#374151", marginLeft: 2 },
  readingCardMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
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
  lifestyleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  lifestyleDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "capitalize",
  },
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
