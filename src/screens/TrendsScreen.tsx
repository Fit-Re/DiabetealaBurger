import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getAdherenceLogsSince,
  getPatientProfile,
  getReadingsSince,
  upsertAdherenceLog,
} from "../db/database";
import {
  buildDailyStats,
  computeTrend,
  summarizeRange,
  toDateKey,
  type DailyStat,
  type RangeSummary,
  type TrendSummary,
} from "../lib/trends";
import { startOfDay } from "../lib/dateTimeUtils";
import type {
  AdherenceLog,
  AdherenceMood,
  AdherenceStatus,
  GlucoseReading,
} from "../types";
import {
  ADHERENCE_MOOD_LABELS,
  ADHERENCE_STATUS_LABELS,
  TARGET_RANGE,
} from "../types";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing, borderRadius, MIN_TOUCH_TARGET, type Palette } from "../theme";

const DAY_MS = 24 * 60 * 60 * 1000;

type TimeRange = "7d" | "30d";

const RANGE_DAYS: Record<TimeRange, number> = { "7d": 7, "30d": 30 };
const RANGE_LABELS: Record<TimeRange, string> = { "7d": "7 días", "30d": "30 días" };

/** Cuántas barras caben sin que se aplasten en un teléfono. */
const MAX_BARS = 14;

const STATUS_ICONS: Record<AdherenceStatus, string> = {
  complied: "✓",
  not_complied: "✗",
  modified: "✎",
};

const MOOD_ICONS: Record<AdherenceMood, string> = {
  good: "😊",
  neutral: "😐",
  bad: "😟",
};

export default function TrendsScreen() {
  const styles = useThemedStyles(createStyles);
  const [range, setRange] = useState<TimeRange>("7d");
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [targetLow, setTargetLow] = useState(TARGET_RANGE.low);
  const [targetHigh, setTargetHigh] = useState(TARGET_RANGE.high);
  const [adherence, setAdherence] = useState<AdherenceLog[]>([]);
  // null mientras no se sabe; false si la migración de adherence_log todavía
  // no se aplicó en esta instancia.
  const [adherenceAvailable, setAdherenceAvailable] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const since = Date.now() - RANGE_DAYS[range] * DAY_MS;
    const [rows, profile, logs] = await Promise.all([
      getReadingsSince(since),
      // Igual que en Inicio: si patient_profile no existe en esta instancia,
      // se cae al rango objetivo por defecto en vez de tumbar la pantalla.
      getPatientProfile().catch(() => null),
      // adherence_log es una tabla nueva; hasta que se pegue la migración en
      // Supabase la sección de cumplimiento simplemente no se muestra.
      getAdherenceLogsSince(since).catch(() => null),
    ]);

    setReadings(rows);
    setTargetLow(profile?.targetRangeLow ?? TARGET_RANGE.low);
    setTargetHigh(profile?.targetRangeHigh ?? TARGET_RANGE.high);
    setAdherenceAvailable(logs !== null);
    setAdherence(logs ?? []);
  }, [range]);

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

  const daily = buildDailyStats(readings, targetLow, targetHigh);
  const trend = computeTrend(daily);
  const summary = summarizeRange(daily);

  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);
  const todayLog = adherence.find((log) => log.dateKey === todayKey) ?? null;

  const saveAdherence = async (
    status: AdherenceStatus,
    mood: AdherenceMood | null
  ) => {
    // Optimista: la fila se pinta ya, y si Supabase falla se recarga la verdad.
    const optimistic: AdherenceLog = {
      id: todayLog?.id ?? -1,
      dateKey: todayKey,
      dateMs: today.getTime(),
      status,
      mood,
      notes: todayLog?.notes ?? null,
      createdAtMs: todayLog?.createdAtMs ?? Date.now(),
    };
    setAdherence((prev) => [optimistic, ...prev.filter((l) => l.dateKey !== todayKey)]);

    try {
      await upsertAdherenceLog({
        dateKey: todayKey,
        dateMs: today.getTime(),
        status,
        mood,
        notes: optimistic.notes,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar tu registro.");
      load();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <RangeSelector value={range} onChange={setRange} />

      {summary.readingCount === 0 ? (
        <Text style={styles.emptyText}>
          No hay lecturas en los últimos {RANGE_DAYS[range]} días. Registra glucosa
          para ver tus tendencias.
        </Text>
      ) : (
        <>
          <TrendIndicator trend={trend} />
          <SummaryGrid summary={summary} />
          <DailyAverageChart
            daily={daily}
            targetLow={targetLow}
            targetHigh={targetHigh}
          />
        </>
      )}

      {adherenceAvailable && (
        <AdherenceTracker
          log={todayLog}
          onChange={saveAdherence}
        />
      )}

      <Text style={styles.disclaimer}>
        Esta app es una herramienta de apoyo y registro personal. No sustituye el
        criterio médico de tu equipo de endocrinología.
      </Text>
    </ScrollView>
  );
}

export function RangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.rangeRow}>
      {(["7d", "30d"] as const).map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.rangeButton, active && styles.rangeButtonActive]}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={`range-${option}${active ? "-active" : ""}`}
          >
            <Text style={[styles.rangeButtonText, active && styles.rangeButtonTextActive]}>
              {RANGE_LABELS[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TREND_COPY: Record<
  TrendSummary["direction"],
  { icon: string; label: string }
> = {
  improving: { icon: "📈", label: "Mejorando" },
  worsening: { icon: "📉", label: "Empeorando" },
  stable: { icon: "➡️", label: "Estable" },
};

export function TrendIndicator({ trend }: { trend: TrendSummary | null }) {
  const styles = useThemedStyles(createStyles);

  if (!trend) {
    return (
      <View style={styles.trendCard}>
        <Text style={styles.trendLabel}>Tendencia general</Text>
        <Text style={styles.trendDetails}>
          Necesitas al menos dos días con lecturas para comparar.
        </Text>
      </View>
    );
  }

  const copy = TREND_COPY[trend.direction];
  const tirDelta = Math.abs(trend.timeInRangeDelta).toFixed(0);
  const avgDelta = Math.abs(trend.averageDelta).toFixed(0);

  return (
    <View style={styles.trendCard} testID={`trend-${trend.direction}`}>
      <Text style={styles.trendLabel}>Tendencia general</Text>
      <Text style={styles.trendValue}>
        {copy.icon} {copy.label}
      </Text>
      <Text style={styles.trendDetails}>
        {trend.direction === "stable"
          ? `Sin cambio relevante en tiempo en rango (${tirDelta} pp)`
          : `${trend.timeInRangeDelta > 0 ? "+" : "−"}${tirDelta} puntos de tiempo en rango`}
        {" · "}
        {trend.averageDelta > 0 ? "+" : "−"}
        {avgDelta} mg/dL de promedio
      </Text>
    </View>
  );
}

export function SummaryGrid({ summary }: { summary: RangeSummary }) {
  const styles = useThemedStyles(createStyles);

  const cells: { label: string; value: string }[] = [
    {
      label: "Promedio",
      value: summary.average == null ? "--" : summary.average.toFixed(0),
    },
    {
      label: "En rango",
      value:
        summary.timeInRangePct == null ? "--" : `${summary.timeInRangePct.toFixed(0)}%`,
    },
    { label: "Lecturas bajas", value: String(summary.lowEvents) },
    { label: "Lecturas altas", value: String(summary.highEvents) },
    {
      label: "Estabilidad",
      value: summary.stabilityPct == null ? "--" : `${summary.stabilityPct.toFixed(0)}%`,
    },
    { label: "Días con datos", value: String(summary.dayCount) },
  ];

  return (
    <View style={styles.statsGrid}>
      {cells.map((cell) => (
        <View key={cell.label} style={styles.statCard}>
          <Text style={styles.statValue}>{cell.value}</Text>
          <Text style={styles.statLabel}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function DailyAverageChart({
  daily,
  targetLow,
  targetHigh,
}: {
  daily: DailyStat[];
  targetLow: number;
  targetHigh: number;
}) {
  const styles = useThemedStyles(createStyles);

  const visible = daily.slice(-MAX_BARS);
  if (visible.length === 0) return null;

  // La escala llega al máximo real o al techo del rango objetivo, lo que sea
  // mayor: si todos los días están en rango, las barras no deben tocar el techo.
  const maxValue = Math.max(...visible.map((d) => d.average), targetHigh);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Promedio diario</Text>
      <View style={styles.chartBars}>
        {visible.map((day) => {
          const status =
            day.average < targetLow ? "low" : day.average > targetHigh ? "high" : "inRange";
          const fillStyle = {
            low: styles.barLow,
            high: styles.barHigh,
            inRange: styles.barInRange,
          }[status];
          return (
            <View key={day.dateKey} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  testID={`bar-${day.dateKey}-${status}`}
                  style={[
                    styles.barFill,
                    fillStyle,
                    // Mínimo visible: un día con promedio muy bajo igual debe
                    // pintar barra, si no parece que no hubo lecturas.
                    { height: `${Math.max(4, (day.average / maxValue) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{new Date(day.dateMs).getDate()}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.chartFootnote}>
        Verde en rango ({targetLow}–{targetHigh}), ámbar alto, rojo bajo.
      </Text>
    </View>
  );
}

export function AdherenceTracker({
  log,
  onChange,
}: {
  log: AdherenceLog | null;
  onChange: (status: AdherenceStatus, mood: AdherenceMood | null) => void;
}) {
  const styles = useThemedStyles(createStyles);

  const statuses: AdherenceStatus[] = ["complied", "not_complied", "modified"];
  const moods: AdherenceMood[] = ["good", "neutral", "bad"];

  return (
    <View style={styles.adherenceCard}>
      <Text style={styles.chartTitle}>Cambios aplicados hoy</Text>
      <Text style={styles.adherenceHint}>
        ¿Pudiste seguir el plan acordado con tu médico?
      </Text>

      <View style={styles.adherenceRow}>
        {statuses.map((status) => {
          const active = log?.status === status;
          return (
            <Pressable
              key={status}
              style={[styles.adherenceButton, active && styles.adherenceButtonActive]}
              onPress={() => onChange(status, log?.mood ?? null)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`adherence-status-${status}${active ? "-active" : ""}`}
            >
              <Text style={[styles.adherenceIcon, active && styles.adherenceIconActive]}>
                {STATUS_ICONS[status]}
              </Text>
              <Text
                style={[
                  styles.adherenceButtonText,
                  active && styles.adherenceButtonTextActive,
                ]}
              >
                {ADHERENCE_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* El ánimo es un eje aparte: se puede cumplir y sentirse mal. Solo se
          ofrece cuando ya hay un status, porque la fila necesita uno. */}
      {log && (
        <>
          <Text style={styles.adherenceHint}>¿Cómo te sentiste?</Text>
          <View style={styles.adherenceRow}>
            {moods.map((mood) => {
              const active = log.mood === mood;
              return (
                <Pressable
                  key={mood}
                  style={[styles.adherenceButton, active && styles.adherenceButtonActive]}
                  onPress={() => onChange(log.status, active ? null : mood)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`adherence-mood-${mood}${active ? "-active" : ""}`}
                >
                  <Text style={styles.adherenceIcon}>{MOOD_ICONS[mood]}</Text>
                  <Text
                    style={[
                      styles.adherenceButtonText,
                      active && styles.adherenceButtonTextActive,
                    ]}
                  >
                    {ADHERENCE_MOOD_LABELS[mood]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSecondary },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    rangeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    rangeButton: {
      flex: 1,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    rangeButtonActive: { backgroundColor: c.accent, borderColor: c.accent },
    rangeButtonText: { fontSize: 13, fontWeight: "600", color: c.textBody },
    rangeButtonTextActive: { color: c.textOnAccent },

    trendCard: {
      backgroundColor: c.accentLight,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    trendLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    trendValue: { fontSize: 20, fontWeight: "700", color: c.text },
    trendDetails: { fontSize: 12, color: c.textBody, marginTop: 4, lineHeight: 17 },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: "30%",
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      alignItems: "center",
    },
    statValue: { fontSize: 18, fontWeight: "700", color: c.text },
    statLabel: { fontSize: 11, color: c.textSecondary, marginTop: 2, textAlign: "center" },

    chartCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      marginBottom: spacing.md,
    },
    chartTitle: { fontSize: 14, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 96 },
    barColumn: { flex: 1, alignItems: "center" },
    barTrack: {
      width: "100%",
      height: 76,
      justifyContent: "flex-end",
      backgroundColor: c.bgTertiary,
      borderRadius: borderRadius.sm,
      overflow: "hidden",
    },
    barFill: { width: "100%", borderRadius: borderRadius.sm },
    barInRange: { backgroundColor: c.status.success.fg },
    barHigh: { backgroundColor: c.status.warning.fg },
    barLow: { backgroundColor: c.status.error.fg },
    barLabel: { fontSize: 10, color: c.textSecondary, marginTop: 4 },
    chartFootnote: { fontSize: 10, color: c.textMuted, marginTop: spacing.sm },

    adherenceCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: 12,
      marginBottom: spacing.md,
    },
    adherenceHint: { fontSize: 12, color: c.textSecondary, marginBottom: spacing.sm },
    adherenceRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
    adherenceButton: {
      flex: 1,
      minHeight: MIN_TOUCH_TARGET,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    adherenceButtonActive: { backgroundColor: c.accentLight, borderColor: c.accent },
    // Sin color explícito estos glifos salen negros: en tema oscuro quedaban
    // negro sobre tarjeta oscura, ilegibles.
    adherenceIcon: { fontSize: 18, color: c.textBody },
    adherenceIconActive: { color: c.accent },
    adherenceButtonText: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 2,
      textAlign: "center",
    },
    adherenceButtonTextActive: { color: c.accent },

    emptyText: {
      color: c.textSecondary,
      textAlign: "center",
      marginVertical: spacing.lg,
      lineHeight: 20,
    },
    disclaimer: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: "center",
      marginTop: spacing.md,
      fontStyle: "italic",
    },
  });
