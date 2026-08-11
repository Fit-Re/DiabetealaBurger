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
  getPatientProfile,
  getReadingsBetween,
  getReadingsSince,
} from "../db/database";
import { addDays, isSameDay, startOfDay } from "../lib/dateTimeUtils";
import { detectPatterns } from "../lib/patterns";
import type {
  GlucoseReading,
  LifestyleMetric,
  PatientProfile,
  PatternFinding,
} from "../types";
import { TARGET_RANGE, TREND_LABELS } from "../types";
import { usePatternEvidence } from "../hooks/usePatternEvidence";
import { EvidenceFeedbackButtons } from "../components/EvidenceFeedbackButtons";
import {
  EvidenceSynthesisBox,
  SynthesizeButton,
} from "../components/EvidenceSynthesisBox";
import { useThemedStyles, usePalette } from "../hooks/useThemedStyles";
import { spacing, borderRadius, type Palette } from "../theme";

const DAY_MS = 24 * 60 * 60 * 1000;
const PATTERN_WINDOW_MS = 14 * DAY_MS;

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dayLabel(day: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(day, today)) return "Hoy";
  if (isSameDay(day, addDays(today, -1))) return "Ayer";
  return capitalizeFirst(
    day.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  );
}

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles);
  const [dayStart, setDayStart] = useState(() => startOfDay(new Date()));
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [patterns, setPatterns] = useState<PatternFinding[]>([]);
  const [lifestyleMetrics, setLifestyleMetrics] = useState<LifestyleMetric[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = isSameDay(dayStart, startOfDay(new Date()));

  const load = useCallback(async () => {
    const since = Date.now() - PATTERN_WINDOW_MS;
    const [dayReadings, rows, meals, medications, medicationLogs, lifestyle, patientProfile] =
      await Promise.all([
        getReadingsBetween(dayStart.getTime(), dayStart.getTime() + DAY_MS),
        getReadingsSince(since),
        getMealsSince(since),
        getActiveMedications(),
        getMedicationLogsSince(since),
        getLifestyleMetricsSince(since),
        // La migración de patient_profile todavía no se corre en todas las
        // instancias de producción — si la tabla no existe, no debe tumbar
        // el resto de la pantalla, solo caer al TARGET_RANGE por defecto.
        getPatientProfile().catch(() => null),
      ]);
    setReadings(dayReadings);
    setLifestyleMetrics(lifestyle);
    setProfile(patientProfile);
    const effectiveTargetLow = patientProfile?.targetRangeLow ?? TARGET_RANGE.low;
    setPatterns(
      detectPatterns(rows, meals, medications, medicationLogs, lifestyle, effectiveTargetLow)
    );
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

  const targetLow = profile?.targetRangeLow ?? TARGET_RANGE.low;
  const targetHigh = profile?.targetRangeHigh ?? TARGET_RANGE.high;
  const stats = computeStats(readings, targetLow, targetHigh);
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

      {latest && (
        <CurrentReadingCard
          reading={latest}
          isToday={isToday}
          targetLow={targetLow}
          targetHigh={targetHigh}
        />
      )}

      {chronological.length > 1 ? (
        <View style={styles.chartCard}>
          <GlucoseChart
            readings={chronological}
            low={targetLow}
            high={targetHigh}
            width={Dimensions.get("window").width - 32 - 24}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.legendRange]} />
              <Text style={styles.legendText}>Rango objetivo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineLow]} />
              <Text style={styles.legendText}>Bajo ({targetLow})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineHigh]} />
              <Text style={styles.legendText}>Alto ({targetHigh})</Text>
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
        <StatCard label={`Bajas (<${targetLow})`} value={String(stats.lowCount)} />
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

export function CurrentReadingCard({
  reading,
  isToday,
  targetLow,
  targetHigh,
}: {
  reading: GlucoseReading;
  isToday: boolean;
  targetLow: number;
  targetHigh: number;
}) {
  const styles = useThemedStyles(createStyles);
  const status =
    reading.value < targetLow
      ? "low"
      : reading.value > targetHigh
      ? "high"
      : "inRange";
  const statusStyles = {
    inRange: { card: styles.readingCardInRange, bar: styles.readingBarInRange },
    low: { card: styles.readingCardLow, bar: styles.readingBarLow },
    high: { card: styles.readingCardHigh, bar: styles.readingBarHigh },
  }[status];

  return (
    <View style={[styles.readingCard, statusStyles.card]} testID={`reading-card-${status}`}>
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

export function StatCard({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
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

export function LifestyleCard({ metric }: { metric: LifestyleMetric }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.lifestyleCard}>
      <Text style={styles.lifestyleDate}>
        {capitalizeFirst(
          new Date(metric.dateMs).toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
        )}
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

// Badge de tendencia (Fase 4): color según si el patrón mejora, empeora o se
// mantiene respecto a la corrida previa. Neutro para "nuevo"/"estable".
const trendBadges = (
  c: Palette
): Record<
  NonNullable<PatternFinding["trend"]>,
  { label: string; color: string; bg: string }
> => ({
  new: { label: "nuevo", color: c.textBody, bg: c.bgTertiary },
  worsening: { label: "↑ empeorando", color: c.status.error.strong, bg: c.status.error.surface },
  improving: { label: "↓ mejorando", color: c.status.success.strong, bg: c.status.success.surface },
  stable: { label: "= estable", color: c.textBody, bg: c.bgTertiary },
});

function PatternCard({ pattern }: { pattern: PatternFinding }) {
  const styles = useThemedStyles(createStyles);
  const badges = trendBadges(usePalette());
  const [expanded, setExpanded] = useState(false);
  const {
    searching,
    evidence,
    synthesizing,
    synthesis,
    feedbackStates,
    loadEvidence,
    synthesize,
    sendFeedback,
  } = usePatternEvidence(pattern);

  const onToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadEvidence();
  };

  return (
    <Pressable style={styles.patternCard} onPress={onToggle}>
      <View style={styles.patternHeader}>
        <Text style={styles.patternTitle}>{pattern.title}</Text>
        {pattern.trend && (
          <Text
            style={[
              styles.patternTrendBadge,
              {
                color: badges[pattern.trend].color,
                backgroundColor: badges[pattern.trend].bg,
              },
            ]}
          >
            {badges[pattern.trend].label}
          </Text>
        )}
        <Text style={styles.patternSeverity}>{SEVERITY_LABELS[pattern.severity]}</Text>
      </View>
      <Text style={styles.patternDescription}>{pattern.description}</Text>

      {expanded && (
        <View style={styles.patternEvidence}>
          {searching && <ActivityIndicator style={{ marginTop: 8 }} />}
          {evidence?.map((e) => (
            <View key={e.paperId} style={styles.evidenceCard}>
              <Text style={styles.evidenceTitle}>
                {e.paper.title} {e.paper.curated ? "" : "· 🔴 no revisado (PubMed en vivo)"}
              </Text>
              <Text style={styles.evidenceMeta}>
                {e.paper.authors} ({e.paper.year || "s/f"}) · {e.paper.source}
              </Text>
              <Text style={styles.evidenceMeta}>
                Confianza: {e.confidence.toUpperCase()} ({(e.activationScore * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.evidenceMeta}>
                Ruta: {e.path.join(" → ")}
              </Text>

              <EvidenceFeedbackButtons
                value={feedbackStates[e.paperId]}
                onPress={(wasHelpful) => sendFeedback(e.paperId, wasHelpful)}
              />
            </View>
          ))}

          {evidence && evidence.length > 0 && !synthesis && (
            <SynthesizeButton synthesizing={synthesizing} onPress={synthesize} />
          )}

          {synthesis && <EvidenceSynthesisBox synthesis={synthesis} />}
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary, padding: spacing.md },
    title: { fontSize: 20, fontWeight: "700", marginBottom: spacing.sm, color: c.text },
    subtitle: {
      fontSize: 16,
      fontWeight: "600",
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      color: c.text,
    },
    dayNavRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dayNavLabelWrap: { flex: 1, alignItems: "center" },
    dayNavToday: {
      fontSize: 11,
      color: c.accent,
      fontWeight: "600",
      marginTop: -6,
      marginBottom: spacing.sm,
    },
    dayNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dayNavButtonDisabled: { opacity: 0.3 },
    dayNavArrow: { fontSize: 22, fontWeight: "700", color: c.text },
    dayNavArrowDisabled: { color: c.textMuted },
    chartCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      marginBottom: spacing.sm,
    },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendSwatch: { width: 10, height: 10, borderRadius: 2 },
    legendRange: { backgroundColor: c.status.success.surface },
    legendLine: { width: 12, height: 0, borderTopWidth: 2, borderStyle: "dashed" },
    legendLineLow: { borderTopColor: c.status.error.fg },
    legendLineHigh: { borderTopColor: c.status.warning.fg },
    legendText: { fontSize: 10, color: c.textSecondary },
    readingCard: {
      flexDirection: "row",
      borderRadius: borderRadius.lg,
      marginBottom: 12,
      overflow: "hidden",
    },
    readingCardBar: { width: 6 },
    readingCardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
    readingCardInRange: { backgroundColor: c.status.success.surfaceSubtle },
    readingCardLow: { backgroundColor: c.status.error.surfaceSubtle },
    readingCardHigh: { backgroundColor: c.status.warning.surfaceSubtle },
    readingBarInRange: { backgroundColor: c.status.success.fg },
    readingBarLow: { backgroundColor: c.status.error.fg },
    readingBarHigh: { backgroundColor: c.status.warning.fg },
    readingCardLabel: { fontSize: 12, fontWeight: "600", color: c.textSecondary },
    readingCardValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
    readingCardValue: { fontSize: 34, fontWeight: "800", color: c.text },
    readingCardUnit: { fontSize: 13, color: c.textSecondary },
    readingCardTrend: { fontSize: 18, color: c.textBody, marginLeft: 2 },
    readingCardMeta: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    emptyChart: {
      height: 100,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
    },
    emptyText: { color: c.textSecondary, textAlign: "center" },
    statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
    lifestyleCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      marginBottom: spacing.sm,
    },
    lifestyleDate: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      alignItems: "center",
    },
    statValue: { fontSize: 18, fontWeight: "700", color: c.text },
    statLabel: { fontSize: 11, color: c.textSecondary, marginTop: 2, textAlign: "center" },
    readingRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 6,
    },
    readingValue: { fontSize: 16, fontWeight: "600", color: c.text },
    readingMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    hint: { fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: spacing.sm },
    disclaimer: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: "center",
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      fontStyle: "italic",
    },
    patternCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 14,
      marginBottom: spacing.sm,
    },
    patternHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    patternTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1, marginRight: spacing.sm },
    patternSeverity: { fontSize: 11, fontWeight: "600" },
    patternTrendBadge: {
      fontSize: 10,
      fontWeight: "700",
      marginRight: spacing.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    patternDescription: { fontSize: 12, color: c.textBody, marginTop: 6, lineHeight: 17 },
    patternEvidence: { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
    evidenceCard: {
      backgroundColor: c.bgSecondary,
      borderRadius: borderRadius.md,
      padding: 10,
      marginBottom: 6,
    },
    evidenceTitle: { fontSize: 12, fontWeight: "700", color: c.text },
    evidenceMeta: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  });
